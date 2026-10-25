import db from './database';
import { monthRange } from './budgetAPI';
import { getByTransaction, type SplitInput, type SplitWithPerson } from './splitsAPI';

export type { SplitInput };

export type TxType = 'expense' | 'income';

export interface Transaction {
  id: number;
  amount: number;
  paid_by: string;
  paid_for: string | null;
  account_id: number | null;
  type: TxType;
  is_split: 0 | 1;
  created_at: string;
}

export interface TransactionWithSplits extends Transaction {
  splits: SplitWithPerson[];
}

export interface TransactionInput {
  amount: number;
  paid_by?: string;
  paid_for?: string | null;
  account_id?: number | null;
  type?: TxType;
  splits?: SplitInput[];
}

const UPDATABLE = ['amount', 'paid_by', 'paid_for', 'account_id', 'type'] as const;
type Updatable = Partial<Pick<Transaction, (typeof UPDATABLE)[number]>>;

export function getAll(limit = 50, offset = 0): Transaction[] {
  return db.getAllSync<Transaction>(
    `SELECT * FROM transactions 
    ORDER BY created_at DESC, id 
    DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

export function getByMonth(month: number, year: number): Transaction[] {
  const [start, end] = monthRange(month, year);

  return db.getAllSync<Transaction>(
    `SELECT * FROM transactions
    WHERE created_at >= ? AND created_at < ?
    ORDER BY created_at DESC, id DESC`,
    [start, end]
  );
}

export function getByID(id: number): TransactionWithSplits | null {
  const tx = db.getFirstSync<Transaction>(
    `SELECT * FROM transactions 
    WHERE id = ?`, 
    [id]
  );

  if (!tx) return null;

  return { ...tx, splits: getByTransaction(id) };
}

export function create(input: TransactionInput): number {
  const splits = input.splits ?? [];
  let id = 0;

  db.withTransactionSync(() => {
    id = db.runSync(
      `INSERT INTO transactions 
      (amount, paid_by, paid_for, account_id, type, is_split)
      VALUES(?, ?, ?, ?, ?, ?)`,
      [
        input.amount,
        input.paid_by ?? 'me',
        input.paid_for ?? null,
        input.account_id ?? null,
        input.type ?? 'expense',
        splits.length ? 1 : 0
      ]
    ).lastInsertRowId;

    for (const s of splits) {
      db.runSync(
        `INSERT INTO splits
        (transaction_id, person_id, share_amount)
        VALUES(?, ?, ?)`,
        [
          id,
          s.person_id,
          s.share_amount
        ]
      );
    }
  });

  return id;
}

export function update(id: number, fields: Updatable): void {
  const keys = UPDATABLE.filter((k) => fields[k] !== undefined);
  if (!keys.length) return;

  db.runSync(
    `UPDATE transactions 
    SET ${keys.map((k) => `${k} = ?`).join(', ')}
    WHERE id = ?`,
    [
      ...keys.map((k) => fields[k] as any),
      id
    ]
  );
}

export function remove(id: number): void {
  db.runSync(
    `DELETE FROM transactions
    WHERE id = ?`,
    [id]
  );
}

export function createSettlement(
  input: Omit<TransactionInput, 'splits'>,
  splitIds: number[]
): number {
  if (!splitIds.length) throw new Error('No splits to settle');

  let id = 0;
  db.withTransactionSync(() => {
    // not create(): it opens its own transaction, and SQLite can't nest BEGIN
    id = db.runSync(
      `INSERT INTO transactions
      (amount, paid_by, paid_for, account_id, type)
      VALUES(?, ?, ?, ?, ?)`,
      [
        input.amount,
        input.paid_by ?? 'me',
        input.paid_for ?? null,
        input.account_id ?? null,
        input.type ?? 'income'
      ]
    ).lastInsertRowId;
    const ph = splitIds.map(() => '?').join(', ');

    const { changes } = db.runSync(
      `UPDATE splits
      SET settled = 1, settled_at = datetime('now', '+5 hours', '+30 minutes'), source_transaction_id = ?
      WHERE id IN (${ph}) AND settled = 0`,
      [
        id, 
        ...splitIds
      ]
    );

    // throwing rolls back the insert, so no orphan repayment is left behind
    if (changes !== splitIds.length) throw new Error('Some splits are missing or already settled');
  });

  return id;
}

// the net of the chosen splits decides direction: +ve they pay me (income), -ve I pay them (expense)
export function settleSplits(
  splitIds: number[],
  input: Pick<TransactionInput, 'paid_for' | 'account_id'> = {}
): number {
  const ph = splitIds.map(() => '?').join(', ');
  const net = db.getFirstSync<{ net: number | null }>(
    `SELECT SUM(share_amount) AS net FROM splits
    WHERE id IN (${ph}) AND settled = 0`,
    splitIds
  )?.net ?? 0;

  // ponytail: a zero net (equal debts both ways) can't be a transaction (amount > 0); add an offset-only settle if it comes up
  if (!net) throw new Error('Nothing to settle');

  return createSettlement(
    {
      ...input,
      amount: Math.abs(net),
      type: net > 0 ? 'income' : 'expense'
    },
    splitIds
  );
}
