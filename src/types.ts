import type { InstrumentationConfig } from '@opentelemetry/instrumentation'

/**
 * Configuration options for ClickHouse instrumentation.
 */
export interface ClickHouseInstrumentationConfig extends InstrumentationConfig {
  /**
   * Maximum length of the query to include in the span.
   * Queries longer than this will be truncated.
   * Set to 0 to disable query capture.
   * @default 2048
   */
  maxQueryLength?: number

  /**
   * Whether to require a parent span to create child spans.
   * @default false
   */
  requireParentSpan?: boolean

  /**
   * Whether to suppress internal HTTP instrumentation.
   * When true, the HTTP spans for ClickHouse requests will not be created
   * by @opentelemetry/instrumentation-http, avoiding duplicate spans.
   * @default true
   */
  suppressInternalInstrumentation?: boolean
}
