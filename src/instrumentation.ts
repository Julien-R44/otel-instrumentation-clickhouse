import type { Span } from '@opentelemetry/api'

import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from '@opentelemetry/instrumentation'
import { suppressTracing } from '@opentelemetry/core'
import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api'

import type { ClickHouseInstrumentationConfig } from './types.js'
import type { ClickHouseClient, InsertParams, QueryParams } from './internal_types.js'

import {
  ATTR_DB_COLLECTION_NAME,
  ATTR_DB_NAME,
  ATTR_DB_NAMESPACE,
  ATTR_DB_OPERATION,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  ATTR_DB_SYSTEM_NAME,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  DEFAULT_CONFIG,
  INSTRUMENTATION_NAME,
  INSTRUMENTATION_VERSION,
  MODULE_NAME,
} from './constants.js'

export class ClickHouseInstrumentation extends InstrumentationBase<ClickHouseInstrumentationConfig> {
  constructor(config: ClickHouseInstrumentationConfig = {}) {
    super(INSTRUMENTATION_NAME, INSTRUMENTATION_VERSION, {
      ...DEFAULT_CONFIG,
      ...config,
    })
  }

  /**
   * Wrap a method on the prototype with instrumentation.
   */
  #wrapMethod(prototype: any, methodName: string, operation: string) {
    if (isWrapped(prototype[methodName])) this._unwrap(prototype, methodName)

    this._wrap(prototype, methodName, this.#createWrapper(operation))
  }

  /**
   * Create a wrapper function that instruments the original method.
   */
  #createWrapper(operation: string) {
    // oxlint-disable-next-line no-this-alias
    const instrumentation = this

    return function wrapper(original: Function) {
      return function (this: ClickHouseClient, params: QueryParams | InsertParams) {
        const config = instrumentation.getConfig()

        const parentSpan = trace.getSpan(context.active())
        if (config.requireParentSpan && !parentSpan) return original.apply(this, arguments)

        const tableName = instrumentation.#extractTableName(params, operation)
        const queryText = instrumentation.#extractQueryText(params, operation)
        const spanName = tableName
          ? `clickhouse.${operation} ${tableName}`
          : `clickhouse.${operation}`
        const attributes = instrumentation.#buildAttributes({
          client: this,
          operation,
          tableName,
          queryText,
        })

        const span = instrumentation.tracer.startSpan(spanName, {
          kind: SpanKind.CLIENT,
          attributes,
        })

        const spanContext = trace.setSpan(context.active(), span)

        return context.with(spanContext, () => {
          const result = instrumentation.#callOriginalFunction(original, this, arguments) as any

          if (result && typeof result.then === 'function') {
            return result.then(
              (res: unknown) => {
                instrumentation.#endSpan(span, null)
                return res
              },
              (err: Error) => {
                instrumentation.#endSpan(span, err)
                throw err
              },
            )
          }

          instrumentation.#endSpan(span, null)

          return result
        })
      }
    }
  }

  /**
   * Extract the table/collection name from params.
   *
   * For `insert` operations, we use `params.table` directly (clean approach).
   * For other operations (`query`, `command`, `exec`), the ClickHouse client
   * only provides raw SQL strings, so we fall back to regex parsing.
   */
  #extractTableName(
    params: QueryParams | InsertParams | undefined,
    operation: string,
  ): string | null {
    if (!params) return null

    if (operation === 'insert' && 'table' in params && params.table) return params.table.trim()

    if ('query' in params && params.query) return this.#parseTableFromQuery(params.query)

    return null
  }

  /**
   * Extract a displayable query text from the params.
   */
  #extractQueryText(params: QueryParams | InsertParams | undefined, operation: string): string {
    if (!params) return operation

    if ('query' in params && params.query) return this.#normalizeQuery(params.query)

    if ('table' in params && params.table) return `INSERT INTO ${params.table}`

    return operation
  }

  /**
   * Normalize query text by collapsing excessive whitespace.
   */
  #normalizeQuery(query: string): string {
    return query.replace(/\s+/g, ' ').trim()
  }

  /**
   * Parse table name from SQL query string.
   * This is a best-effort extraction for common SQL patterns.
   */
  #parseTableFromQuery(query: string): string | null {
    if (!query) return null

    const normalized = query.trim().toUpperCase()

    const fromMatch = query.match(/\bFROM\s+([`"]?[\w.]+[`"]?)/i)
    if (fromMatch) return fromMatch[1].replace(/[`"]/g, '')

    const insertMatch = query.match(/\bINSERT\s+INTO\s+([`"]?[\w.]+[`"]?)/i)
    if (insertMatch) return insertMatch[1].replace(/[`"]/g, '')

    if (normalized.startsWith('UPDATE')) {
      const updateMatch = query.match(/\bUPDATE\s+([`"]?[\w.]+[`"]?)/i)
      if (updateMatch) return updateMatch[1].replace(/[`"]/g, '')
    }

    if (normalized.startsWith('DELETE')) {
      const deleteMatch = query.match(/\bDELETE\s+FROM\s+([`"]?[\w.]+[`"]?)/i)
      if (deleteMatch) return deleteMatch[1].replace(/[`"]/g, '')
    }

    return null
  }

  /**
   * Build span attributes from the client and operation context.
   */
  #buildAttributes(options: {
    client: ClickHouseClient
    operation: string
    tableName: string | null
    queryText: string
  }): Record<string, string | number | undefined> {
    const { client, operation, tableName, queryText } = options
    const config = this.getConfig()
    const maxQueryLength = config.maxQueryLength ?? 2048

    const attributes: Record<string, string | number | undefined> = {
      [ATTR_DB_SYSTEM_NAME]: 'clickhouse',
      [ATTR_DB_OPERATION_NAME]: operation,
      [ATTR_DB_SYSTEM]: 'clickhouse',
      [ATTR_DB_OPERATION]: operation,
    }

    if (tableName) attributes[ATTR_DB_COLLECTION_NAME] = tableName

    if (maxQueryLength > 0 && queryText) {
      const truncatedQuery =
        queryText.length > maxQueryLength
          ? queryText.substring(0, maxQueryLength) + '...'
          : queryText

      attributes[ATTR_DB_QUERY_TEXT] = truncatedQuery
      attributes[ATTR_DB_STATEMENT] = truncatedQuery
    }

    if (client.connectionParams) {
      const url = client.connectionParams.url
      if (url) {
        attributes[ATTR_SERVER_ADDRESS] = url.hostname
        if (url.port) attributes[ATTR_SERVER_PORT] = Number.parseInt(url.port, 10)
      }

      if (client.connectionParams.database) {
        attributes[ATTR_DB_NAMESPACE] = client.connectionParams.database
        attributes[ATTR_DB_NAME] = client.connectionParams.database
      }
    }

    return attributes
  }

  /**
   * Call the original function, optionally suppressing HTTP instrumentation.
   */
  #callOriginalFunction(original: Function, thisArg: ClickHouseClient, args: IArguments): unknown {
    const config = this.getConfig()

    if (config.suppressInternalInstrumentation) {
      return context.with(suppressTracing(context.active()), () => original.apply(thisArg, args))
    }

    return original.apply(thisArg, args)
  }

  /**
   * End a span with either success or error status.
   */
  #endSpan(span: Span, error: Error | null) {
    if (error) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    } else {
      span.setStatus({ code: SpanStatusCode.OK })
    }

    span.end()
  }

  /**
   * Initialize the instrumentation by defining module patches.
   */
  protected init() {
    return new InstrumentationNodeModuleDefinition(
      MODULE_NAME,
      ['>=1.0.0'],
      (moduleExports: any) => {
        const ClickHouseClientClass = moduleExports.ClickHouseClient

        if (!ClickHouseClientClass?.prototype) return moduleExports

        this.#wrapMethod(ClickHouseClientClass.prototype, 'query', 'query')
        this.#wrapMethod(ClickHouseClientClass.prototype, 'insert', 'insert')
        this.#wrapMethod(ClickHouseClientClass.prototype, 'command', 'command')
        this.#wrapMethod(ClickHouseClientClass.prototype, 'exec', 'exec')

        return moduleExports
      },
      (moduleExports: any) => {
        const ClickHouseClientClass = moduleExports.ClickHouseClient

        if (!ClickHouseClientClass?.prototype) return moduleExports

        this._unwrap(ClickHouseClientClass.prototype, 'query')
        this._unwrap(ClickHouseClientClass.prototype, 'insert')
        this._unwrap(ClickHouseClientClass.prototype, 'command')
        this._unwrap(ClickHouseClientClass.prototype, 'exec')

        return moduleExports
      },
    )
  }
}
