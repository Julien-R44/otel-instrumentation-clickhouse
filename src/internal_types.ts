/**
 * Internal representation of the ClickHouse client instance.
 * Used for accessing connection parameters during instrumentation.
 */
export interface ClickHouseClient {
  connectionParams?: {
    url?: URL
    database?: string
  }
}

/**
 * Parameters for query, command, and exec operations.
 */
export interface QueryParams {
  query?: string
  query_id?: string
}

/**
 * Parameters for insert operations.
 * Extends QueryParams with table name support.
 */
export interface InsertParams extends QueryParams {
  table?: string
}
