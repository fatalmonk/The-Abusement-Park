import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/api/**/*.test.js', 'tests/dom/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['functions/api/standings.js'],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 70
      }
    }
  }
});
