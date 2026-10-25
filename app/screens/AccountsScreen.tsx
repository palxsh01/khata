import { useMemo, useReducer, useState } from 'react';
import { Alert } from 'react-native';
import * as accountsAPI from '../db/accountsAPI';
import type { AccountWithBalance } from '../db/accountsAPI';
import { color } from '../theme';
import { Button, Card, Empty, Field, Header, Hero, ListRow, Screen, Sheet, Tile, parseAmount } from '../ui';
import { inr } from './activity';

interface Draft {
  id: number | null; // null = new account
  name: string;
  balance: string;
}

export default function AccountsScreen() {
  const [v, reload] = useReducer((x: number) => x + 1, 0);
  const accounts = useMemo(() => accountsAPI.getAll(), [v]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const totalBalance = accounts.reduce((a, x) => a + x.current_balance, 0);
  const opening = parseAmount(draft?.balance || '0');
  const valid = !!draft?.name.trim() && Number.isFinite(opening);

  const edit = (a: AccountWithBalance) => setDraft({ id: a.id, name: a.name, balance: String(a.balance) });

  const save = () => {
    if (!draft || !valid) return;
    try {
      if (draft.id === null) accountsAPI.create(draft.name, opening);
      else accountsAPI.update(draft.id, { name: draft.name, balance: opening });
      setDraft(null);
      reload();
    } catch {
      Alert.alert('Name taken', `You already have an account called ${draft.name.trim()}.`);
    }
  };

  const remove = () => {
    if (draft?.id == null) return;
    try {
      accountsAPI.remove(draft.id);
      setDraft(null);
      reload();
    } catch {
      Alert.alert("Can't delete", 'This account still has transactions.');
    }
  };

  return (
    <Screen>
      <Header title="Accounts" icon="add" onPress={() => setDraft({ id: null, name: '', balance: '' })} />
      <Hero
        label="Total balance"
        value={inr(totalBalance, 0)}
        sub={`across ${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
      />

      {accounts.length ? (
        <Card>
          {accounts.map((a, i) => (
            <ListRow
              key={a.id}
              first={i === 0}
              left={<Tile id={a.id} text={a.name} />}
              title={a.name}
              sub={`opening ${inr(a.balance, 0)}`}
              right={inr(a.current_balance)}
              rightColor={a.current_balance < 0 ? color.negative : undefined}
              onPress={() => edit(a)}
            />
          ))}
        </Card>
      ) : (
        <Empty text="Add a bank account, card or cash wallet" />
      )}

      <Sheet visible={draft !== null} title={draft?.id == null ? 'New account' : 'Edit account'} onClose={() => setDraft(null)}>
        <Field
          label="Name"
          value={draft?.name ?? ''}
          onChangeText={(name) => draft && setDraft({ ...draft, name })}
          placeholder="HDFC"
          autoFocus={draft?.id == null}
        />
        <Field
          label="Opening balance"
          value={draft?.balance ?? ''}
          onChangeText={(balance) => draft && setDraft({ ...draft, balance })}
          keyboardType="numeric"
          placeholder="0"
        />
        <Button label="Save" onPress={save} disabled={!valid} />
        {draft?.id != null && <Button label="Delete account" onPress={remove} danger />}
      </Sheet>
    </Screen>
  );
}
