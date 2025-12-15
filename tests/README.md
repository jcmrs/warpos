# Tests

This directory contains automated tests for the warpos MCP server.

## Structure

- `unit/` - Unit tests for individual components (schema validation, stores, etc.)
- `integration/` - Integration tests for MCP tools and end-to-end workflows

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx vitest tests/unit/schema.test.ts

# Watch mode
npx vitest --watch
```

## Coverage Requirements

Minimum coverage thresholds (configured in vitest.config.ts):
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

## Writing Tests

- Unit tests: Test individual functions/classes in isolation with mocked dependencies
- Integration tests: Test MCP tools with real file I/O and full system integration
- Follow TDD: Write failing test → implement → verify passing → refactor
