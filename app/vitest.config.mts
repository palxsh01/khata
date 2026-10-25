import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { 'expo-sqlite': new URL('./test/expoSqlite.ts', import.meta.url).pathname }
  },
  test: {
    include: ['db/**/*.test.ts', 'screens/**/*.test.ts'],
    setupFiles: ['./test/setup.ts']
  }
});
