import db from './database';

export interface Account {
  id: number;
  name: string;
  balance: number;
  created_at: string;
}

export interface AccountWithBalance extends Account {
  current_balance: number;
}

// balance column = opening balance; current_balance is derived from transactions
const SELECT_WITH_BALANCE =
  `SELECT a.*,
    a.balance + COALESCE(SUM(
      CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END
    ), 0) AS current_balance
  FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id`;

export function getAll(): AccountWithBalance[] {
  return db.getAllSync<AccountWithBalance>(
    `${SELECT_WITH_BALANCE}
    GROUP BY a.id
    ORDER BY a.name`
  );
}

export function getByID(id: number): AccountWithBalance | null {
  return db.getFirstSync<AccountWithBalance>(
    `${SELECT_WITH_BALANCE}
    WHERE a.id = ?
    GROUP BY a.id`,
    [id]
  );
}

export function create(name: string, balance = 0): number {
  return db.runSync(
    `INSERT INTO accounts (name, balance)
    VALUES(?, ?)`,
    [
      name.trim(),
      balance
    ]
  ).lastInsertRowId;
}

export function update(id: number, fields: Partial<Pick<Account, 'name' | 'balance'>>): void {
  db.runSync(
    `UPDATE accounts
    SET name = COALESCE(?, name), balance = COALESCE(?, balance)
    WHERE id = ?`,
    [
      fields.name?.trim() ?? null,
      fields.balance ?? null,
      id
    ]
  );
}

export function remove(id: number): void {
  // throws FK error if transactions still reference the account
  db.runSync(
    `DELETE FROM accounts
    WHERE id = ?`,
    [id]
  );
}