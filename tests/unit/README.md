# Unit Tests

Unit tests for individual components of warpos. These tests focus on testing functions and classes in isolation with mocked dependencies.

## Test Files

- `schema.test.ts` - JSON Schema validation helpers
- `profileStore.test.ts` - Domain Profile loading, inheritance, and compilation
- `templateStore.test.ts` - Task Template library operations
- `instanceStore.test.ts` - Task Instance generation and validation
- `taskExecutor.test.ts` - Variable substitution and execution plan generation

## Guidelines

- Mock external dependencies (file I/O, network calls)
- Test one behavior per test case
- Use descriptive test names: `test_function_scenario_expectedResult`
- Keep tests fast (< 1ms each)
- Test edge cases and error conditions
