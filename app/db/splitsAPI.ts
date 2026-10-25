import db from './database';

export interface Split {
  id: number;
  transaction_id: number;
  person_id: number;
  share_amount: number;
  settled: 0 | 1;
  settled_at: string | null;
  source_transaction_id: number | null;
  created_at: string;
}

export interface SplitWithPerson extends Split {
  person_name: string;
}

export interface UnsettledSplit extends SplitWithPerson {
  paid_for: string | null;
}

export interface SplitInput {
  person_id: number;
  share_amount: number;
}

export interface PersonBalance {
  person_id: number;
  person_name: string;
  balance: number;
}

const SELECT_WITH_PERSON =
  `SELECT s.*, p.name AS person_name
  FROM splits s
  JOIN people p ON p.id = s.person_id`;

export function getAll(): SplitWithPerson[] {
  return db.getAllSync<SplitWithPerson>(
    `${SELECT_WITH_PERSON}
    ORDER BY s.created_at DESC, s.id DESC`
  );
}

export function getByID(id: number): SplitWithPerson | null {
  return db.getFirstSync<SplitWithPerson>(
    `${SELECT_WITH_PERSON}
    WHERE s.id = ?`,
    [id]
  );
}

export function getByTransaction(transactionId: number): SplitWithPerson[] {
  return db.getAllSync<SplitWithPerson>(
    `${SELECT_WITH_PERSON}
    WHERE s.transaction_id = ?`,
    [transactionId]
  );
}

export function getUnsettled(personId: number): UnsettledSplit[] {
  return db.getAllSync<UnsettledSplit>(
    `SELECT s.*, p.name AS person_name, t.paid_for
    FROM splits s
    JOIN people p ON p.id = s.person_id
    JOIN transactions t ON t.id = s.transaction_id
    WHERE s.person_id = ? AND s.settled = 0
    ORDER BY s.created_at, s.id`,
    [personId]
  );
}

// +ve = they owe me, -ve = I owe them
export function getBalances(): PersonBalance[] {
  return db.getAllSync<PersonBalance>(
    `SELECT p.id AS person_id, p.name AS person_name, SUM(s.share_amount) AS balance
    FROM splits s
    JOIN people p ON p.id = s.person_id
    WHERE s.settled = 0
    GROUP BY p.id
    ORDER BY p.name`
  );
}

export function create(transactionId: number, input: SplitInput): number {
  let id = 0;

  db.withTransactionSync(() => {
    id = db.runSync(
      `INSERT INTO splits
      (transaction_id, person_id, share_amount)
      VALUES(?, ?, ?)`,
      [
        transactionId,
        input.person_id,
        input.share_amount
      ]
    ).lastInsertRowId;

    db.runSync(
      `UPDATE transactions
      SET is_split = 1
      WHERE id = ?`,
      [transactionId]
    );
  });

  return id;
}

export function update(id: number, fields: Partial<SplitInput>): void {
  db.runSync(
    `UPDATE splits
    SET person_id = COALESCE(?, person_id), share_amount = COALESCE(?, share_amount)
    WHERE id = ?`,
    [
      fields.person_id ?? null,
      fields.share_amount ?? null,
      id
    ]
  );
}

export function remove(id: number): void {
  db.withTransactionSync(() => {
    const split = db.getFirstSync<Split>(
      `SELECT * FROM splits
      WHERE id = ?`,
      [id]
    );

    if (!split) return;

    db.runSync(
      `DELETE FROM splits
      WHERE id = ?`,
      [id]
    );

    db.runSync(
      `UPDATE transactions
      SET is_split = EXISTS (SELECT 1 FROM splits WHERE transaction_id = ?)
      WHERE id = ?`,
      [
        split.transaction_id,
        split.transaction_id
      ]
    );
  });
}