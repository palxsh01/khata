import db from './database';
import * as accountsAPI from './accountsAPI';
import * as budgetAPI from './budgetAPI';
import * as peopleAPI from './peopleAPI';
import * as splitsAPI from './splitsAPI';
import * as transactionsAPI from './transactionsAPI';

const ITEMS = [
  ['Groceries', 900],
  ['Coffee', 180],
  ['Lunch', 350],
  ['Auto', 120],
  ['Petrol', 1500],
  ['Movie', 600],
  ['Medicine', 420],
  ['Snacks', 90]
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function wipe(): void {
  db.execSync(
    `DELETE FROM splits;
    DELETE FROM transactions;
    DELETE FROM budgets;
    DELETE FROM people;
    DELETE FROM accounts;`
  );
}

// DEV ONLY: wipes everything, then fills this month and last month with sample data
export function seed(now = new Date()): void {
  wipe();

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const [pm, py] = month === 1 ? [12, year - 1] : [month - 1, year];
  const daysAgo = (n: number) => Math.max(1, today - n);

  const at = (id: number, y: number, m: number, d: number, h: number) =>
    db.runSync(
      `UPDATE transactions
      SET created_at = ?
      WHERE id = ?`,
      [
        `${y}-${pad(m)}-${pad(d)} ${pad(h)}:15:00`,
        id
      ]
    );

  const hdfc = accountsAPI.create('HDFC', 50000);
  const cash = accountsAPI.create('Cash', 3000);
  const [aman, bina, rahul] = ['Aman', 'Bina', 'Rahul'].map((n) => peopleAPI.create(n));

  budgetAPI.create(pm, py, 30000);
  budgetAPI.create(month, year, 30000);

  // two everyday spends a day, deterministic so screenshots stay stable
  let i = 0;
  const spendDay = (y: number, m: number, d: number) => {
    for (const h of [9, 17]) {
      const [what, base] = ITEMS[i % ITEMS.length];
      const id = transactionsAPI.create({
        amount: base + ((i * 37) % 200),
        paid_for: what,
        account_id: i % 3 ? hdfc : cash
      });
      at(id, y, m, d, h);
      i++;
    }
  };

  for (let d = 1; d <= new Date(py, pm, 0).getDate(); d++) spendDay(py, pm, d);
  for (let d = 1; d <= today; d++) spendDay(year, month, d);

  for (const [y, m] of [[py, pm], [year, month]]) {
    at(transactionsAPI.create({ amount: 85000, type: 'income', paid_for: 'Salary', account_id: hdfc }), y, m, 1, 10);
  }

  // splits: Aman and Bina owe for dinner, I owe Rahul for a cab, Rahul owes for tickets
  const dinner = transactionsAPI.create({
    amount: 2400,
    paid_for: 'Dinner',
    account_id: hdfc,
    splits: [
      { person_id: aman, share_amount: 800 },
      { person_id: bina, share_amount: 800 }
    ]
  });
  at(dinner, year, month, daysAgo(5), 21);

  const cab = transactionsAPI.create({
    amount: 600,
    paid_by: 'Rahul',
    paid_for: 'Cab',
    splits: [{ person_id: rahul, share_amount: -300 }]
  });
  at(cab, year, month, daysAgo(2), 23);

  const tickets = transactionsAPI.create({
    amount: 3000,
    paid_for: 'Concert tickets',
    account_id: hdfc,
    splits: [{ person_id: rahul, share_amount: 1500 }]
  });
  at(tickets, year, month, daysAgo(8), 19);

  // Aman already paid back
  transactionsAPI.settleSplits(
    splitsAPI.getByTransaction(dinner).filter((s) => s.person_id === aman).map((s) => s.id),
    { paid_for: 'Aman settled up', account_id: hdfc }
  );
}
