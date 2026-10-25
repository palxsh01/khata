import { describe, expect, it } from 'vitest';
import db from './database';
import * as budgets from './budgetAPI';
import * as people from './peopleAPI';
import * as splits from './splitsAPI';
import * as tx from './transactionsAPI';

// pin a row to a given IST timestamp
const at = (id: number, ts: string) => db.runSync('UPDATE transactions SET created_at = ? WHERE id = ?', [ts, id]);

describe('budgetAPI', () => {
  it('CRUD', () => {
    const id = budgets.create(9, 2026, 10000);
    expect(budgets.getByID(id)).toMatchObject({ month: 9, year: 2026, budget: 10000 });
    budgets.update(id, 12000);
    expect(budgets.getByID(id)?.budget).toBe(12000);
    budgets.remove(id);
    expect(budgets.getByID(id)).toBeNull();
  });

  it('getAll is newest month first', () => {
    budgets.create(12, 2025, 1);
    budgets.create(2, 2026, 1);
    budgets.create(1, 2026, 1);
    expect(budgets.getAll().map((b) => `${b.year}-${b.month}`)).toEqual(['2026-2', '2026-1', '2025-12']);
  });

  it('enforces one budget per month and valid ranges', () => {
    budgets.create(9, 2026, 1);
    expect(() => budgets.create(9, 2026, 2)).toThrow(/UNIQUE/);
    expect(() => budgets.create(13, 2026, 1)).toThrow(/CHECK/);
    expect(() => budgets.create(1, 2026, 0)).toThrow(/CHECK/);
  });

  it('getByMonth returns null with no budget', () => {
    expect(budgets.getByMonth(9, 2026)).toBeNull();
  });

  it('remaining / pending / projected', () => {
    budgets.create(9, 2026, 10000);
    const a = people.create('Aman');

    at(tx.create({ amount: 1000 }), '2026-09-05 12:00:00');                         // plain spend
    const dinner = tx.create({ amount: 900, splits: [{ person_id: a, share_amount: 600 }] });
    at(dinner, '2026-09-10 21:00:00');                                             // they owe 600
    const cab = tx.create({ amount: 400, paid_by: 'Aman', splits: [{ person_id: a, share_amount: -200 }] });
    at(cab, '2026-09-11 09:00:00');                                                // I owe 200, not my spend
    at(tx.create({ amount: 5000, type: 'income' }), '2026-09-01 10:00:00');       // income ignored
    at(tx.create({ amount: 777 }), '2026-10-01 00:00:00');                         // next month

    let s = budgets.getByMonth(9, 2026)!;
    expect(s.remaining).toBe(10000 - 1000 - 900);
    expect(s.pending).toBe(600 - 200);
    expect(s.projected).toBe(s.remaining + s.pending);

    // they repay 600: comes back into remaining, leaves pending
    tx.createSettlement({ amount: 600 }, splits.getByTransaction(dinner).map((x) => x.id));
    s = budgets.getByMonth(9, 2026)!;
    expect(s.remaining).toBe(10000 - 1000 - 900 + 600);
    expect(s.pending).toBe(-200);
  });

  it('IST month boundary: 23:59 on the 30th stays in September', () => {
    budgets.create(9, 2026, 1000);
    budgets.create(10, 2026, 1000);
    at(tx.create({ amount: 100 }), '2026-09-30 23:59:59');
    at(tx.create({ amount: 50 }), '2026-10-01 00:00:00');
    expect(budgets.getByMonth(9, 2026)?.remaining).toBe(900);
    expect(budgets.getByMonth(10, 2026)?.remaining).toBe(950);
  });

  it('December rolls into next year', () => {
    budgets.create(12, 2026, 1000);
    at(tx.create({ amount: 100 }), '2026-12-31 23:00:00');
    at(tx.create({ amount: 999 }), '2027-01-01 00:00:00');
    expect(budgets.getByMonth(12, 2026)?.remaining).toBe(900);
  });
});
