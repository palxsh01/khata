import { describe, expect, it } from 'vitest';
import db from './database';
import * as people from './peopleAPI';
import * as splits from './splitsAPI';
import * as tx from './transactionsAPI';

describe('transactionsAPI', () => {
  it('creates with defaults', () => {
    const id = tx.create({ amount: 100 });
    expect(tx.getByID(id)).toMatchObject({
      amount: 100, paid_by: 'me', paid_for: null, account_id: null, type: 'expense', is_split: 0, splits: []
    });
  });

  it('stores created_at in IST', () => {
    const id = tx.create({ amount: 1 });
    const created = tx.getByID(id)!.created_at;
    const ist = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
    expect(created.slice(0, 16)).toBe(ist);
  });

  it('accepts a backdated created_at', () => {
    const id = tx.create({ amount: 1, created_at: '2026-09-03 12:00:00' });
    expect(tx.getByID(id)!.created_at).toBe('2026-09-03 12:00:00');
  });

  it('creates splits and sets is_split', () => {
    const p = people.create('Rahul');
    const id = tx.create({ amount: 100, splits: [{ person_id: p, share_amount: 50 }] });
    const t = tx.getByID(id)!;
    expect(t.is_split).toBe(1);
    expect(t.splits).toHaveLength(1);
    expect(t.splits[0]).toMatchObject({ person_name: 'Rahul', share_amount: 50, settled: 0 });
  });

  it('rolls back the transaction row if a split is invalid', () => {
    expect(() => tx.create({ amount: 100, splits: [{ person_id: 999, share_amount: 50 }] })).toThrow();
    expect(tx.getAll()).toHaveLength(0);
  });

  it('rejects non-positive amounts and bad types', () => {
    expect(() => tx.create({ amount: 0 })).toThrow(/CHECK/);
    expect(() => tx.create({ amount: 1, type: 'gift' as any })).toThrow(/CHECK/);
  });

  it('getAll is newest first and paginates', () => {
    const a = tx.create({ amount: 1 });
    const b = tx.create({ amount: 2 });
    const c = tx.create({ amount: 3 });
    expect(tx.getAll().map((t) => t.id)).toEqual([c, b, a]);
    expect(tx.getAll(1, 1).map((t) => t.id)).toEqual([b]);
  });

  it('getByMonth returns only that IST month, newest first', () => {
    const at = (id: number, ts: string) => db.runSync('UPDATE transactions SET created_at = ? WHERE id = ?', [ts, id]);
    const a = tx.create({ amount: 1 });
    const b = tx.create({ amount: 2 });
    const c = tx.create({ amount: 3 });
    at(a, '2026-09-01 00:00:00');
    at(b, '2026-09-30 23:59:59');
    at(c, '2026-10-01 00:00:00');
    expect(tx.getByMonth(9, 2026).map((t) => t.id)).toEqual([b, a]);
  });

  it('getByID returns null when missing', () => {
    expect(tx.getByID(999)).toBeNull();
  });

  it('updates only the given whitelisted fields', () => {
    const id = tx.create({ amount: 100, paid_for: 'dinner' });
    tx.update(id, { amount: 120 });
    expect(tx.getByID(id)).toMatchObject({ amount: 120, paid_for: 'dinner' });
    tx.update(id, {});
    expect(tx.getByID(id)?.amount).toBe(120);
    tx.update(id, { is_split: 1 } as any); // not whitelisted, ignored
    expect(tx.getByID(id)?.is_split).toBe(0);
  });

  it('remove cascades to its splits', () => {
    const p = people.create('Rahul');
    const id = tx.create({ amount: 100, splits: [{ person_id: p, share_amount: 50 }] });
    tx.remove(id);
    expect(tx.getByID(id)).toBeNull();
    expect(splits.getAll()).toHaveLength(0);
  });

  describe('createSettlement', () => {
    const setup = () => {
      const p = people.create('Rahul');
      const t = tx.create({ amount: 300, splits: [{ person_id: p, share_amount: 100 }, { person_id: p, share_amount: 50 }] });
      const [s1, s2] = splits.getByTransaction(t).map((s) => s.id);
      return { p, t, s1, s2 };
    };

    it('inserts an income tx and settles only the chosen splits', () => {
      const { s1, s2 } = setup();
      const id = tx.createSettlement({ amount: 100 }, [s1]);
      expect(tx.getByID(id)).toMatchObject({ type: 'income', amount: 100, is_split: 0 });
      expect(splits.getByID(s1)).toMatchObject({ settled: 1, source_transaction_id: id });
      expect(splits.getByID(s1)?.settled_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
      expect(splits.getByID(s2)).toMatchObject({ settled: 0, source_transaction_id: null });
    });

    it('honours type override (I pay them back)', () => {
      const { s1 } = setup();
      const id = tx.createSettlement({ amount: 100, type: 'expense' }, [s1]);
      expect(tx.getByID(id)?.type).toBe('expense');
    });

    it('throws and leaves no orphan tx when a split is already settled', () => {
      const { s1, s2 } = setup();
      tx.createSettlement({ amount: 100 }, [s1]);
      const before = tx.getAll().length;
      expect(() => tx.createSettlement({ amount: 150 }, [s1, s2])).toThrow(/already settled/);
      expect(tx.getAll()).toHaveLength(before);
      expect(splits.getByID(s2)?.settled).toBe(0);
    });

    it('throws on empty split list', () => {
      expect(() => tx.createSettlement({ amount: 1 }, [])).toThrow();
    });

    it('deleting the settlement reopens its splits (trigger)', () => {
      const { s1 } = setup();
      const id = tx.createSettlement({ amount: 100 }, [s1]);
      tx.remove(id);
      expect(splits.getByID(s1)).toMatchObject({ settled: 0, settled_at: null, source_transaction_id: null });
    });

    it('leaves no open SQL transaction behind', () => {
      const { s1 } = setup();
      tx.createSettlement({ amount: 100 }, [s1]);
      expect(() => db.withTransactionSync(() => {})).not.toThrow();
    });
  });

  describe('settleSplits', () => {
    const setup = () => {
      const p = people.create('Rahul');
      const a = tx.create({ amount: 300, splits: [{ person_id: p, share_amount: 100 }] });
      const b = tx.create({ amount: 400, paid_by: 'Rahul', splits: [{ person_id: p, share_amount: -250 }] });
      return { owesMe: splits.getByTransaction(a)[0].id, iOwe: splits.getByTransaction(b)[0].id };
    };

    it('they owe me -> income for the amount', () => {
      const { owesMe } = setup();
      const id = tx.settleSplits([owesMe], { paid_for: 'Rahul settled' });
      expect(tx.getByID(id)).toMatchObject({ type: 'income', amount: 100, paid_for: 'Rahul settled' });
    });

    it('nets mixed splits; I owe more -> expense', () => {
      const { owesMe, iOwe } = setup();
      const id = tx.settleSplits([owesMe, iOwe]);
      expect(tx.getByID(id)).toMatchObject({ type: 'expense', amount: 150 });
      expect(splits.getUnsettled(splits.getByID(owesMe)!.person_id)).toHaveLength(0);
    });

    it('throws when nothing is left to settle', () => {
      const { owesMe } = setup();
      tx.settleSplits([owesMe]);
      expect(() => tx.settleSplits([owesMe])).toThrow(/already settled/);
      expect(() => tx.settleSplits([])).toThrow(/Nothing to settle/);
    });

    it('zero net (they bought me something instead) settles with no transaction', () => {
      const p = people.create('Rahul');
      const owed = tx.create({ amount: 3000, splits: [{ person_id: p, share_amount: 1500 }] });
      const gift = tx.create({ amount: 1500, paid_by: 'Rahul', paid_for: 'Shoes', splits: [{ person_id: p, share_amount: -1500 }] });
      const ids = [owed, gift].map((t) => splits.getByTransaction(t)[0].id);
      const before = tx.getAll().length;

      expect(tx.settleSplits(ids)).toBe(0);
      expect(tx.getAll()).toHaveLength(before);
      expect(splits.getUnsettled(p)).toHaveLength(0);
      expect(splits.getByID(ids[0])).toMatchObject({ settled: 1, source_transaction_id: null });
    });
  });
});

