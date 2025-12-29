# OpenTelemetry ClickHouse Instrumentation

This module provides automatic instrumentation and tracing for [ClickHouse](https://clickhouse.com/) in Node.js applications using the official [@clickhouse/client](https://www.npmjs.com/package/@clickhouse/client) package

Compatible with OpenTelemetry JS API and SDK `1.0+`.

## Installation

```bash
pnpm add @julr/otel-instrumentation-clickhouse
```

### Supported Versions

- [`@clickhouse/client`](https://www.npmjs.com/package/@clickhouse/client) versions `>=1.0.0`
- [`@clickhouse/client-web`](https://www.npmjs.com/package/@clickhouse/client-web) versions `>=1.0.0`

## Usage

```js
const { ClickHouseInstrumentation } = require('@julr/otel-instrumentation-clickhouse');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new ClickHouseInstrumentation({
      // optional params
      // maxQueryLength: 2048,
      // requireParentSpan: false,
      // suppressInternalInstrumentation: true,
    }),
  ],
});
```

## Configuration Options

| Option                            | Type    | Default | Description                                                                                                                                                      |
| --------------------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxQueryLength`                  | number  | 2048    | Maximum length of the query to include in the span. Queries longer than this will be truncated. Set to `0` to disable query capture.                             |
| `requireParentSpan`               | boolean | false   | Whether to require a parent span to create child spans. When `true`, ClickHouse spans will only be created if there is an active parent span.                    |
| `suppressInternalInstrumentation` | boolean | true    | Whether to suppress internal HTTP instrumentation. When `true`, HTTP spans for ClickHouse requests will not be created by `@opentelemetry/instrumentation-http`. |

## Instrumented Methods

The following ClickHouse client methods are automatically instrumented:

- `query()` - Execute SELECT queries
- `insert()` - Insert data into tables
- `command()` - Execute DDL commands (CREATE, ALTER, etc.)
- `exec()` - Execute raw queries

## Span Attributes

This instrumentation sets the following span attributes following [OpenTelemetry Semantic Conventions for Database](https://opentelemetry.io/docs/specs/semconv/database/database-spans/):

| Attribute            | Description                                     |
| -------------------- | ----------------------------------------------- |
| `db.system.name`     | Always set to `clickhouse`                      |
| `db.operation.name`  | The operation type (`query`, `insert`, etc.)    |
| `db.query.text`      | The SQL query (truncated if exceeds max length) |
| `db.namespace`       | The database name                               |
| `db.collection.name` | The table name (when available)                 |
| `server.address`     | The ClickHouse server hostname                  |
| `server.port`        | The ClickHouse server port                      |

## Useful Links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[license-url]: https://github.com/julr/otel-instrumentation-clickhouse/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@julr/otel-instrumentation-clickhouse
[npm-img]: https://badge.fury.io/js/%40julr%2Fotel-instrumentation-clickhouse.svg
