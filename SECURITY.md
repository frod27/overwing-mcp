# Security

## Reporting a vulnerability

Email **support@overwing.ai** with what you found and how to reproduce it. Please do not open a public issue for a vulnerability. Good-faith reports are welcome and we aim to acknowledge them within three business days.

This covers the `overwing-mcp` package and the Overwing service at overwing.ai. When testing the service, use your own account, and do not run load tests or access other customers' data.

## What this package does

- Runs locally over stdio, started by your MCP client.
- Reads three environment variables: `OVERWING_API_KEY`, `OVERWING_AGENT_KEY`, `OVERWING_BASE_URL`.
- Makes HTTPS requests to the Overwing API (`https://overwing.ai` unless `OVERWING_BASE_URL` says otherwise) and to no other host.
- Reads no files and runs no commands.
- Has two runtime dependencies: `@modelcontextprotocol/sdk` and `zod`.

The whole server is [src/index.ts](src/index.ts).

## What the service does with your data

See [overwing.ai/security](https://overwing.ai/security) and [overwing.ai/privacy](https://overwing.ai/privacy): what is stored, who processes it, how to turn storage off (`store: false`, `store_inputs`, `retention_days`), and how to restrict a key to running checks (`scope: "evaluate"`).

## Supported versions

Only the latest release on npm receives fixes.
