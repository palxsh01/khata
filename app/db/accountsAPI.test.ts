import { describe, expect, it } from 'vitest';
import * as accounts from './accountsAPI';
import * as tx from './transactionsAPI';

describe('accountsAPI', () => {
  it('creates with default opening balance 0', () => {
    const id = accounts.create(' HDFC ');
    expect(accounts.getByID(id)).toMatchObject({ name: 'HDFC', balance: 0, current_balance: 0 });
  });

  it('current_balance = opening + income - expense', () => {
    const id = accounts.create('HDFC', 1000);
    tx.create({ amount: 300, account_id: id });
    tx.create({ amount: 50, account_id: id, type: 'income' });
    tx.create({ amount: 999 }); // no account, must not count
    expect(accounts.getByID(id)?.current_balance).toBe(750);
  });

  it('getAll sorts by name and includes accounts with no transactions', () => {
    accounts.create('SBI', 10);
    accounts.create('Cash', 5);
    expect(accounts.getAll().map((a) => [a.name, a.current_balance])).toEqual([['Cash', 5], ['SBI', 10]]);
  });

  it('getByID returns null when missing', () => {
    expect(accounts.getByID(999)).toBeNull();
  });

  it('partial update keeps untouched fields', () => {
    const id = accounts.create('HDFC', 1000);
    accounts.update(id, { balance: 2000 });
    expect(accounts.getByID(id)).toMatchObject({ name: 'HDFC', balance: 2000 });
    accounts.update(id, { name: 'HDFC Savings' });
    expect(accounts.getByID(id)).toMatchObject({ name: 'HDFC Savings', balance: 2000 });
  });

  it('update allows balance 0', () => {
    const id = accounts.create('HDFC', 1000);
    accounts.update(id, { balance: 0 });
    expect(accounts.getByID(id)?.balance).toBe(0);
  });

  it('removes an unused account', () => {
    const id = accounts.create('HDFC');
    accounts.remove(id);
    expect(accounts.getByID(id)).toBeNull();
  });

  it('refuses to remove an account with transactions', () => {
    const id = accounts.create('HDFC');
    tx.create({ amount: 10, account_id: id });
    expect(() => accounts.remove(id)).toThrow(/FOREIGN KEY/);
  });
});
