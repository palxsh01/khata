import { describe, expect, it } from 'vitest';
import type { Transaction } from '../db/transactionsAPI';
import { applyFilters, bucketTotals, compact, dayBuckets, dayLabel, groupByDay, isoDate, inr, monthBuckets, pctChange, shares, total, weekBuckets } from './activity';

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
    const days = bucketTotals(applyFilters(txs, 'expense', null), dayBuckets(2026, 9));
    expect(days).toHaveLength(30);
    expect(days[24]).toBe(100);
    expect(days[23]).toBe(50);
    expect(days.reduce((a, b) => a + b)).toBe(150);
  });

  it('day buckets tick 1, 7, 14, 21, 28 and the last day', () => {
    const b = dayBuckets(2026, 2);
    expect(b).toHaveLength(28);
    expect(b.filter((x) => x.label).map((x) => x.label)).toEqual(['1', '7', '14', '21', '28']);
  });

  it('week buckets step 7 days, stop at end and name each new month', () => {
    const b = weekBuckets('2026-08-01', '2026-11-01');
    expect(b).toHaveLength(14);
    expect(b[1].start).toBe('2026-08-08');
    expect(b[b.length - 1].start).toBe('2026-10-31');
    expect(b.filter((x) => x.label).map((x) => x.start)).toEqual(['2026-08-01', '2026-09-05', '2026-10-03']);
  });

  it('month buckets cross years; monthly totals', () => {
    const b = monthBuckets(2025, 11, 12);
    expect([b[0].start, b[2].start, b[11].start]).toEqual(['2025-11-01', '2026-01-01', '2026-10-01']);
    expect(monthBuckets(2024, 6, 30).filter((x) => x.label).map((x) => x.label)).toEqual(['2024', '2025', '2026']);
    const totals = bucketTotals(applyFilters(txs, 'expense', null), monthBuckets(2026, 8, 3));
    expect(totals).toEqual([0, 150, 0]);
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

  it('shares: typed as-is, blanks split the rest with me', () => {
    expect(shares(900, [null, null])).toEqual([300, 300]);
    expect(shares(1000, [600, null])).toEqual([600, 200]);
    expect(shares(100, [null, null])).toEqual([33.33, 33.33]);
    expect(shares(500, [500])).toEqual([500]);
  });

  it('isoDate pads', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
