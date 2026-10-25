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

export function dailyTotals(txs: Transaction[], daysInMonth: number): number[] {
  const days = new Array<number>(daysInMonth).fill(0);
  for (const t of txs) if (mine(t)) days[dayOf(t) - 1] += t.amount;
  return days;
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
