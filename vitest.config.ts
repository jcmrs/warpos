import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/index.ts',        // MCP server entrypoint (hard to test)
        'src/zaiClient.ts',    // External API client (requires mocking z.ai)
        'node_modules/**',
        'dist/**'
      ],
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 50,
        statements: 75
      }
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts']
  }
});
