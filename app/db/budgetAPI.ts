import db from './database';

export interface Budget {
  id: number;
  month: number;
  year: number;
  budget: number;
}

export interface BudgetStatus extends Budget {
  remaining: number;
  pending: number;
  projected: number;
}

// created_at is stored in IST, so plain string bounds line up with IST months
export function monthRange(month: number, year: number): [string, string] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const [nm, ny] = month === 12 ? [1, year + 1] : [month + 1, year];

  return [
    `${year}-${pad(month)}-01`,
    `${ny}-${pad(nm)}-01`
  ];
}

export function getAll(): Budget[] {
  return db.getAllSync<Budget>(
    `SELECT * FROM budgets
    ORDER BY year DESC, month DESC`
  );
}

export function getByID(id: number): Budget | null {
  return db.getFirstSync<Budget>(
    `SELECT * FROM budgets
    WHERE id = ?`,
    [id]
  );
}

// remaining = budget - my spend + settled money owed to me
// pending   = unsettled splits (+ve incoming, -ve I still owe)
// projected = remaining after all splits clear (press-and-hold)
export function getByMonth(month: number, year: number): BudgetStatus | null {
  const [start, end] = monthRange(month, year);

  const row = db.getFirstSync<Omit<BudgetStatus, 'projected'>>(
    `SELECT b.*,
      b.budget
        - COALESCE((SELECT SUM(amount) FROM transactions
          WHERE type = 'expense' AND paid_by = 'me'
          AND created_at >= $start AND created_at < $end), 0)
        + COALESCE((SELECT SUM(s.share_amount) FROM splits s
          JOIN transactions t ON t.id = s.transaction_id
          WHERE s.settled = 1 AND s.share_amount > 0
          AND t.created_at >= $start AND t.created_at < $end), 0)
        AS remaining,
      COALESCE((SELECT SUM(s.share_amount) FROM splits s
        JOIN transactions t ON t.id = s.transaction_id
        WHERE s.settled = 0
        AND t.created_at >= $start AND t.created_at < $end), 0)
        AS pending
    FROM budgets b
    WHERE b.month = $month AND b.year = $year`,
    {
      $start: start,
      $end: end,
      $month: month,
      $year: year
    }
  );

  if (!row) return null;

  return { ...row, projected: row.remaining + row.pending };
}

export function create(month: number, year: number, budget: number): number {
  return db.runSync(
    `INSERT INTO budgets (month, year, budget)
    VALUES(?, ?, ?)`,
    [
      month,
      year,
      budget
    ]
  ).lastInsertRowId;
}

export function update(id: number, budget: number): void {
  db.runSync(
    `UPDATE budgets
    SET budget = ?
    WHERE id = ?`,
    [
      budget,
      id
    ]
  );
}

export function remove(id: number): void {
  db.runSync(
    `DELETE FROM budgets
    WHERE id = ?`,
    [id]
  );
}