# Changelog

All notable changes to this project will be documented here.

## 0.1.0 - Initial release

### Added

- MCP server over stdio
- PostgreSQL Docker demo database
- PostgreSQL connection health tool
- schema listing tool
- table listing tool
- table description tool
- table sample tool
- guarded read-only SELECT query tool
- guarded query explanation tool using PostgreSQL EXPLAIN
- relationship summary tool
- PostgreSQL schema resources
- PostgreSQL table resources
- column metadata
- primary key metadata
- foreign key metadata
- index metadata
- unique constraint metadata
- check constraint metadata
- table size and row estimate metadata
- SQL guard unit tests
- PostgreSQL integration tests
- README, docs, contributing guide, and GitHub templates

### Security

- blocked write and destructive SQL keywords
- blocked multiple SQL statements
- blocked row-locking clauses such as `FOR UPDATE`
- blocked SQL placeholders in user-provided queries
- added read-only transactions for guarded queries
- added statement timeout handling
- added maximum row limits
- added schema allowlist support
- added identifier validation and safe table-name quoting

### Notes

This is the first public project milestone. The server is read-only by design, but it should not yet be treated as a complete production security boundary.
