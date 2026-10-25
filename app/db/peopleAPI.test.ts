import { describe, expect, it } from 'vitest';
import * as people from './peopleAPI';
import * as tx from './transactionsAPI';

describe('peopleAPI', () => {
  it('creates, trims and reads back', () => {
    const id = people.create('  Rahul ');
    expect(people.getByID(id)?.name).toBe('Rahul');
  });

  it('getAll sorts by name', () => {
    people.create('Zoya');
    people.create('Aman');
    expect(people.getAll().map((p) => p.name)).toEqual(['Aman', 'Zoya']);
  });

  it('getByID returns null when missing', () => {
    expect(people.getByID(999)).toBeNull();
  });

  it('rejects duplicate names', () => {
    people.create('Rahul');
    expect(() => people.create('Rahul')).toThrow(/UNIQUE/);
  });

  it('updates name', () => {
    const id = people.create('Rahul');
    people.update(id, ' Rahul K ');
    expect(people.getByID(id)?.name).toBe('Rahul K');
  });

  it('removes a person with no splits', () => {
    const id = people.create('Rahul');
    people.remove(id);
    expect(people.getByID(id)).toBeNull();
  });

  it('refuses to remove a person who still has splits', () => {
    const id = people.create('Rahul');
    tx.create({ amount: 100, splits: [{ person_id: id, share_amount: 50 }] });
    expect(() => people.remove(id)).toThrow(/FOREIGN KEY/);
  });
});
