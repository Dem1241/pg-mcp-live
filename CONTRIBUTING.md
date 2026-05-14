# Contributing

Thanks for considering a contribution to `pg-mcp-live`.

This project is still early, so the best contributions are focused, small, and easy to review.

## Project goals

`pg-mcp-live` provides a read-only MCP server for PostgreSQL database inspection and safe querying.

The project prioritizes:

- safety by default
- clear TypeScript code
- small composable modules
- useful PostgreSQL metadata
- good developer experience
- tests for security-sensitive behavior

## Non-goals for now

Please avoid opening pull requests for these until they are part of the roadmap:

- write queries
- database migrations
- admin operations
- destructive SQL support
- complex frontend dashboards
- cloud-specific deployment setup
- authentication systems

These may come later, but the current focus is a safe and reliable read-only core.

## Development setup

Install dependencies:

    npm install

Create a local environment file:

    cp .env.example .env

Start the demo database:

    docker compose -f examples/docker-compose.yml up -d

Run checks:

    npm test
    npm run typecheck
    npm run build

Start the MCP server:

    npm run dev

Test with MCP Inspector:

    npx @modelcontextprotocol/inspector ./node_modules/.bin/tsx src/index.ts

## Pull request guidelines

Before opening a pull request:

- keep the change focused
- add or update tests when behavior changes
- update docs when public tools/resources change
- run `npm test`
- run `npm run typecheck`
- run `npm run build`

## Commit style

Use clear conventional-style commits where possible.

Examples:

    feat(tools): add table index metadata
    fix(security): reject unsafe query pattern
    docs: update inspector setup
    test: add safe query tests

## Security-sensitive changes

Changes to SQL validation, query execution, schema exposure, or database permissions need extra care.

For these changes, include:

- what risk the change addresses
- what inputs are allowed
- what inputs are rejected
- tests for both accepted and rejected behavior

## Reporting security issues

Please do not open a public issue for serious security problems.

For now, open a minimal issue saying that a security concern exists, without exploit details, or contact the maintainer directly.
