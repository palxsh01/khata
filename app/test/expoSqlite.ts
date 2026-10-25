// Test-only stand-in for expo-sqlite, backed by Node's built-in SQLite.
// Implements just the sync API that db/*.ts uses.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

type Params = SQLInputValue[] | Record<string, SQLInputValue>;

const args = (p?: Params) =>
  p === undefined ? [] : Array.isArray(p) ? p : [p];

export function openDatabaseSync(_name: string) {
  const raw = new DatabaseSync(':memory:');

  const api = {
    raw,
    execSync: (sql: string) => raw.exec(sql),
    getAllSync: <T>(sql: string, p?: Params) =>
      raw.prepare(sql).all(...(args(p) as any[])) as T[],
    getFirstSync: <T>(sql: string, p?: Params) =>
      (raw.prepare(sql).get(...(args(p) as any[])) ?? null) as T | null,
    runSync: (sql: string, p?: Params) => {
      const r = raw.prepare(sql).run(...(args(p) as any[]));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    // same BEGIN/COMMIT/ROLLBACK shape as expo-sqlite, so nesting fails the same way
    withTransactionSync: (task: () => void) => {
      raw.exec('BEGIN');
      try {
        task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    }
  };

  return api;
}
