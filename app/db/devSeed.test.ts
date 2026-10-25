import { describe, expect, it } from 'vitest';
import * as accountsAPI from './accountsAPI';
import * as budgetAPI from './budgetAPI';
import { seed } from './devSeed';
import * as splitsAPI from './splitsAPI';
import * as transactionsAPI from './transactionsAPI';

describe('devSeed', () => {
  it('fills this and last month and is re-runnable', () => {
    const now = new Date(2026, 9, 26);
    seed(now);
    seed(now); // wipes first, so no UNIQUE clashes

    expect(accountsAPI.getAll().map((a) => a.name)).toEqual(['Cash', 'HDFC']);
    expect(transactionsAPI.getByMonth(9, 2026).length).toBeGreaterThan(60);
    expect(transactionsAPI.getByMonth(10, 2026).length).toBeGreaterThan(50);
    expect(budgetAPI.getByMonth(10, 2026)).not.toBeNull();
    expect(splitsAPI.getBalances().map((b) => [b.person_name, b.balance])).toEqual([
      ['Bina', 800],
      ['Rahul', 1200]
    ]);
  });

  it('works on the 1st of January', () => {
    expect(() => seed(new Date(2027, 0, 1))).not.toThrow();
    expect(budgetAPI.getByMonth(12, 2026)).not.toBeNull();
  });
});
