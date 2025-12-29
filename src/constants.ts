import type { ClickHouseInstrumentationConfig } from './types.js'

export const MODULE_NAME = '@clickhouse/client-common'
export const INSTRUMENTATION_NAME = '@julr/otel-instrumentation-clickhouse'
export const INSTRUMENTATION_VERSION = '1.0.0'

/**
 * Stable semantic convention attributes for database spans
 * @see https://opentelemetry.io/docs/specs/semconv/database/database-spans/
 */
export const ATTR_DB_SYSTEM_NAME = 'db.system.name'
export const ATTR_DB_QUERY_TEXT = 'db.query.text'
export const ATTR_DB_OPERATION_NAME = 'db.operation.name'
export const ATTR_DB_NAMESPACE = 'db.namespace'
export const ATTR_DB_COLLECTION_NAME = 'db.collection.name'
export const ATTR_SERVER_ADDRESS = 'server.address'
export const ATTR_SERVER_PORT = 'server.port'

/**
 * Deprecated attributes - kept for backward compatibility
 * Can be removed once consumers migrate to stable attributes
 */
export const ATTR_DB_SYSTEM = 'db.system'
export const ATTR_DB_STATEMENT = 'db.statement'
export const ATTR_DB_OPERATION = 'db.operation'
export const ATTR_DB_NAME = 'db.name'

export const DEFAULT_CONFIG: ClickHouseInstrumentationConfig = {
  maxQueryLength: 2048,
  requireParentSpan: false,
  suppressInternalInstrumentation: true,
}
