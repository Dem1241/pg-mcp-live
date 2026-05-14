# Changelog

All notable changes to this project will be documented here.

This project follows a simple versioned changelog format.

## Unreleased

### Added

- Initial MCP server over stdio
- PostgreSQL connection health tool
- schema introspection tools
- table sample tool
- guarded SELECT query tool
- guarded EXPLAIN query tool
- PostgreSQL schema/table MCP resources
- Docker demo database
- SQL guard tests
- project documentation

### Changed

- Improved README structure and setup instructions

### Security

- Added SQL guard for blocking write/admin/destructive SQL keywords
- Added multiple-statement rejection
- Added row-locking clause rejection
- Added read-only transaction wrapper for guarded queries
- Added statement timeout and row limit handling

## 0.1.0

Initial planned release.
