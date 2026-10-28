import type { Transaction, TxType } from '../db/transactionsAPI';

export interface DayGroup {
  date: string;
  total: number;
  items: Transaction[];
}

export function applyFilters(txs: Transaction[], type: TxType, accountId: number | null): Transaction[] {
  return txs.filter((t) => t.type === type && (accountId === null || t.account_id === accountId));
}

// only money that actually left / reached my pocket counts; a friend paying isn't my spend
const mine = (t: Transaction) => t.paid_by === 'me';

export function total(txs: Transaction[]): number {
  return txs.reduce((s, t) => (mine(t) ? s + t.amount : s), 0);
}

// day of month from 'YYYY-MM-DD HH:MM:SS'
export const dayOf = (t: Transaction) => Number(t.created_at.slice(8, 10));

// a chart bar: covers [start, next bucket's start); empty label = no axis tick
export interface Bucket {
  start: string;
  label: string;
}

// one bar per day of the month
export function dayBuckets(year: number, month: number): Bucket[] {
  const n = new Date(year, month, 0).getDate();
  return Array.from({ length: n }, (_, i) => ({
    start: isoDate(new Date(year, month - 1, i + 1)),
    label: [1, 7, 14, 21, 28, n].includes(i + 1) ? String(i + 1) : ''
  }));
}

// 7-day bars from `start` until `end`; the first bar of each month carries its name
export function weekBuckets(start: string, end: string): Bucket[] {
  const [y, m, d] = start.split('-').map(Number);
  const out: Bucket[] = [];
  for (let i = 0; ; i++) {
    const day = new Date(y, m - 1, d + 7 * i);
    const s = isoDate(day);
    if (s >= end) return out;
    const newMonth = s.slice(0, 7) !== out[out.length - 1]?.start.slice(0, 7);
    out.push({ start: s, label: newMonth ? day.toLocaleDateString('en-IN', { month: 'short' }) : '' });
  }
}

// one bar per month from year/month; up to a year every 3rd month is named, beyond that each January as the year
export function monthBuckets(year: number, month: number, count: number): Bucket[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month - 1 + i, 1);
    const label = count <= 12
      ? (i % 3 === 0 ? d.toLocaleDateString('en-IN', { month: 'short' }) : '')
      : (i === 0 || d.getMonth() === 0 ? String(d.getFullYear()) : '');
    return { start: isoDate(d), label };
  });
}

// my spend per bucket; txs are assumed to already be inside the buckets' span
export function bucketTotals(txs: Transaction[], buckets: Bucket[]): number[] {
  const out = buckets.map(() => 0);
  for (const t of txs) {
    const i = buckets.findLastIndex((b) => b.start <= t.created_at);
    if (i >= 0 && mine(t)) out[i] += t.amount;
  }
  return out;
}

// txs arrive newest first, so groups come out newest first too
export function groupByDay(txs: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const t of txs) {
    const date = t.created_at.slice(0, 10);
    let g = groups[groups.length - 1];
    if (g?.date !== date) groups.push((g = { date, total: 0, items: [] }));
    g.items.push(t);
    if (mine(t)) g.total += t.amount;
  }
  return groups;
}

export function pctChange(now: number, before: number): number | null {
  return before ? Math.round(((now - before) / before) * 100) : null;
}

export function inr(n: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(n);
}

export function compact(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n));
}

export function dayLabel(date: string, today: Date): string {
  const [y, m, d] = date.split('-').map(Number);
  const that = new Date(y, m - 1, d);
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return that.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
}

// what each person owes me when I paid: typed amounts as-is, blanks (null) split
// the rest equally with me; my share is whatever's left
export function shares(amount: number, typed: (number | null)[]): number[] {
  const fixed = typed.reduce<number>((a, t) => a + (t ?? 0), 0);
  const each = Math.round(((amount - fixed) / (typed.filter((t) => t === null).length + 1)) * 100) / 100;
  return typed.map((t) => t ?? each);
}

// local calendar date as 'YYYY-MM-DD' (device clock is assumed IST)
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
