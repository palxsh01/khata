import { describe, expect, it } from 'vitest';
import * as people from './peopleAPI';
import * as splits from './splitsAPI';
import * as tx from './transactionsAPI';

describe('splitsAPI', () => {
  it('create adds a split and flips is_split', () => {
    const p = people.create('Rahul');
    const t = tx.create({ amount: 100 });
    const id = splits.create(t, { person_id: p, share_amount: 40 });
    expect(splits.getByID(id)).toMatchObject({ transaction_id: t, person_name: 'Rahul', share_amount: 40, settled: 0 });
    expect(tx.getByID(t)?.is_split).toBe(1);
  });

  it('create rejects a zero share and leaves is_split untouched', () => {
    const p = people.create('Rahul');
    const t = tx.create({ amount: 100 });
    expect(() => splits.create(t, { person_id: p, share_amount: 0 })).toThrow(/CHECK/);
    expect(tx.getByID(t)?.is_split).toBe(0);
  });

  it('getAll / getByTransaction / getByID', () => {
    const p = people.create('Rahul');
    const t1 = tx.create({ amount: 100, splits: [{ person_id: p, share_amount: 10 }] });
    tx.create({ amount: 100, splits: [{ person_id: p, share_amount: 20 }] });
    expect(splits.getAll()).toHaveLength(2);
    expect(splits.getByTransaction(t1).map((s) => s.share_amount)).toEqual([10]);
    expect(splits.getByID(999)).toBeNull();
  });

  it('getUnsettled returns only open splits for that person, oldest first', () => {
    const a = people.create('Aman');
    const b = people.create('Bina');
    tx.create({ amount: 100, splits: [{ person_id: a, share_amount: 10 }, { person_id: b, share_amount: 99 }] });
    tx.create({ amount: 100, splits: [{ person_id: a, share_amount: 20 }] });
    tx.create({ amount: 100, splits: [{ person_id: a, share_amount: 30 }] });
    const [first] = splits.getUnsettled(a);
    tx.createSettlement({ amount: 10 }, [first.id]);
    expect(splits.getUnsettled(a).map((s) => s.share_amount)).toEqual([20, 30]);
    expect(splits.getUnsettled(a)[0]).toHaveProperty('paid_for', null);
  });

  it('getBalances nets signed unsettled shares per person', () => {
    const a = people.create('Aman');
    const b = people.create('Bina');
    tx.create({ amount: 100, splits: [{ person_id: a, share_amount: 50 }] });
    tx.create({ amount: 80, paid_by: 'Aman', splits: [{ person_id: a, share_amount: -30 }] });
    const t = tx.create({ amount: 60, splits: [{ person_id: b, share_amount: 20 }] });
    tx.createSettlement({ amount: 20 }, splits.getByTransaction(t).map((s) => s.id));
    expect(splits.getBalances()).toEqual([{ person_id: a, person_name: 'Aman', balance: 20 }]);
  });

  it('partial update keeps untouched fields', () => {
    const a = people.create('Aman');
    const b = people.create('Bina');
    const t = tx.create({ amount: 100, splits: [{ person_id: a, share_amount: 50 }] });
    const [s] = splits.getByTransaction(t);
    splits.update(s.id, { share_amount: 35 });
    expect(splits.getByID(s.id)).toMatchObject({ person_id: a, share_amount: 35 });
    splits.update(s.id, { person_id: b });
    expect(splits.getByID(s.id)).toMatchObject({ person_id: b, share_amount: 35 });
  });

  it('remove clears is_split only when the last split goes', () => {
    const p = people.create('Rahul');
    const t = tx.create({ amount: 100, splits: [{ person_id: p, share_amount: 10 }, { person_id: p, share_amount: 20 }] });
    const [s1, s2] = splits.getByTransaction(t);
    splits.remove(s1.id);
    expect(tx.getByID(t)?.is_split).toBe(1);
    splits.remove(s2.id);
    expect(tx.getByID(t)?.is_split).toBe(0);
    expect(() => splits.remove(999)).not.toThrow();
  });
});
