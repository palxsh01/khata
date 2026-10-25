import { describe, expect, it } from 'vitest';
import type { Transaction } from '../db/transactionsAPI';
import { applyFilters, compact, dailyTotals, dayLabel, groupByDay, inr, pctChange, total } from './activity';

let id = 0;
const t = (created_at: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: ++id, amount, paid_by: 'me', paid_for: null, account_id: null, type: 'expense', is_split: 0, created_at, ...extra
});

const txs = [
  t('2026-09-25 20:00:00', 100, { account_id: 1 }),
  t('2026-09-25 09:00:00', 400, { paid_by: 'Aman' }),
  t('2026-09-24 13:00:00', 50, { account_id: 2 }),
  t('2026-09-01 10:00:00', 5000, { type: 'income', account_id: 1 })
];

describe('activity helpers', () => {
  it('filters by type and account', () => {
    expect(applyFilters(txs, 'expense', null)).toHaveLength(3);
    expect(applyFilters(txs, 'expense', 1).map((x) => x.amount)).toEqual([100]);
    expect(applyFilters(txs, 'income', null).map((x) => x.amount)).toEqual([5000]);
  });

  it('totals skip what someone else paid', () => {
    expect(total(applyFilters(txs, 'expense', null))).toBe(150);
  });

  it('daily totals land on the right day', () => {
    const days = dailyTotals(applyFilters(txs, 'expense', null), 30);
    expect(days).toHaveLength(30);
    expect(days[24]).toBe(100);
    expect(days[23]).toBe(50);
    expect(days.reduce((a, b) => a + b)).toBe(150);
  });

  it('groups by day, newest first, with my total per day', () => {
    const groups = groupByDay(applyFilters(txs, 'expense', null));
    expect(groups.map((g) => [g.date, g.total, g.items.length])).toEqual([
      ['2026-09-25', 100, 2],
      ['2026-09-24', 50, 1]
    ]);
  });

  it('pctChange', () => {
    expect(pctChange(82, 100)).toBe(-18);
    expect(pctChange(5, 0)).toBeNull();
  });

  it('formats', () => {
    expect(inr(120000, 0)).toBe('₹1,20,000');
    expect(inr(38.25)).toBe('₹38.25');
    expect(compact(30000)).toBe('30k');
    expect(compact(1250)).toBe('1.3k');
    expect(compact(640.4)).toBe('640');
  });

  it('day labels', () => {
    const today = new Date(2026, 8, 25, 10);
    expect(dayLabel('2026-09-25', today)).toBe('Today');
    expect(dayLabel('2026-09-24', today)).toBe('Yesterday');
    expect(dayLabel('2026-09-07', today)).toBe('7 September');
  });
});
