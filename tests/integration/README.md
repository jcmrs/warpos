# Integration Tests

Integration tests for MCP tools and end-to-end workflows. These tests use real file I/O and full system integration.

## Test Files

- `domainProfile.test.ts` - Domain Profile MCP tools (list, get, put, delete, agent_run)
- `mcd.test.ts` - MCD MCP tools (list, get, put)
- `taskTemplate.test.ts` - Task Template MCP tools (list, get, put, delete)
- `taskInstance.test.ts` - Task Instance MCP tools (list, get, generate)
- `taskExecution.test.ts` - Task Execution MCP tools (prepare, execute)
- `zai.test.ts` - z.ai integration (zai_plan)

## Guidelines

- Use real file I/O (create test files in temp directories)
- Clean up test data after each test (beforeEach/afterEach)
- Test full workflows end-to-end
- Verify actual behavior, not mock behavior
- Test error handling with invalid inputs
