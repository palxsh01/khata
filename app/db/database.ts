import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('khata.db');

db.execSync(
  `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
  );

  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    budget REAL NOT NULL CHECK (budget > 0),
    UNIQUE (month, year)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL CHECK (amount > 0),
    paid_by TEXT NOT NULL DEFAULT 'me',
    paid_for TEXT,
    account_id INTEGER REFERENCES accounts(id),
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    is_split INTEGER NOT NULL DEFAULT 0 CHECK (is_split IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
  );
  
  CREATE TABLE IF NOT EXISTS splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id),
    share_amount REAL NOT NULL CHECK (share_amount != 0),
    settled INTEGER NOT NULL DEFAULT 0 CHECK (settled in (0, 1)),
    settled_at TEXT,
    source_transaction_id INTEGER REFERENCES transactions(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
  );

  CREATE INDEX IF NOT EXISTS idx_splits_person_settled ON splits(person_id, settled);
  CREATE INDEX IF NOT EXISTS idx_splits_transaction ON splits(transaction_id);

  CREATE TRIGGER IF NOT EXISTS reopen_splits_on_transaction_delete
  AFTER DELETE ON transactions
  BEGIN
    UPDATE splits
    SET settled = 0, settled_at = NULL, source_transaction_id = NULL
    WHERE source_transaction_id = old.id;
  END;
  `
)

export default db;