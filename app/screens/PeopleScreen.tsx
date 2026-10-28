import { useMemo, useReducer, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as peopleAPI from '../db/peopleAPI';
import type { Person } from '../db/peopleAPI';
import * as splitsAPI from '../db/splitsAPI';
import type { UnsettledSplit } from '../db/splitsAPI';
import * as transactionsAPI from '../db/transactionsAPI';
import { color } from '../theme';
import { Button, Card, Empty, Field, Header, Hero, ListRow, Screen, Sheet, Tile } from '../ui';
import { dayLabel, inr } from './activity';

export default function PeopleScreen() {
  const [v, reload] = useReducer((x: number) => x + 1, 0);
  const { people, balance } = useMemo(() => ({
    people: peopleAPI.getAll(),
    balance: new Map(splitsAPI.getBalances().map((b) => [b.person_id, b.balance]))
  }), [v]);

  const [adding, setAdding] = useState<string | null>(null); // null = sheet closed
  const [settling, setSettling] = useState<Person | null>(null);

  const owedToMe = [...balance.values()].filter((b) => b > 0).reduce((a, b) => a + b, 0);
  const iOwe = [...balance.values()].filter((b) => b < 0).reduce((a, b) => a - b, 0);

  const add = () => {
    try {
      peopleAPI.create(adding ?? '');
      setAdding(null);
      reload();
    } catch {
      Alert.alert('Already added', `${adding?.trim()} is already in your list.`);
    }
  };

  const confirmRemove = (p: Person) =>
    Alert.alert(`Remove ${p.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            peopleAPI.remove(p.id);
            reload();
          } catch {
            Alert.alert("Can't remove", `${p.name} still has splits. Delete those first.`);
          }
        }
      }
    ]);

  return (
    <Screen>
      <Header title="People" icon="person-add" onPress={() => setAdding('')} />
      <Hero
        label="Net owed to you"
        value={inr(owedToMe - iOwe, 0)}
        sub={`${inr(owedToMe, 0)} to you · ${inr(iOwe, 0)} you owe`}
      />

      {people.length ? (
        <Card>
          {people.map((p, i) => {
            const b = balance.get(p.id) ?? 0;
            return (
              <ListRow
                key={p.id}
                first={i === 0}
                left={<Tile id={p.id} text={p.name} />}
                title={p.name}
                right={b ? inr(Math.abs(b)) : '—'}
                rightSub={b > 0 ? 'owes you' : b < 0 ? 'you owe' : balance.has(p.id) ? 'evens out' : 'settled up'}
                rightColor={b > 0 ? color.positive : b < 0 ? color.negative : color.textTertiary}
                onPress={balance.has(p.id) ? () => setSettling(p) : undefined}
                onLongPress={() => confirmRemove(p)}
              />
            );
          })}
        </Card>
      ) : (
        <Empty text="Add the people you split with" />
      )}

      <Sheet visible={adding !== null} title="Add person" onClose={() => setAdding(null)}>
        <Field label="Name" value={adding ?? ''} onChangeText={setAdding} placeholder="Rahul" autoFocus />
        <Button label="Add" onPress={add} disabled={!adding?.trim()} />
      </Sheet>

      {settling && (
        <SettleSheet
          person={settling}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null);
            reload();
          }}
        />
      )}
    </Screen>
  );
}

// tick the splits this repayment covers; all ticked by default
function SettleSheet({ person, onClose, onDone }: { person: Person; onClose: () => void; onDone: () => void }) {
  const splits = useMemo(() => splitsAPI.getUnsettled(person.id), [person.id]);
  const [picked, setPicked] = useState(() => new Set(splits.map((s) => s.id)));

  const net = Math.round(splits.filter((s) => picked.has(s.id)).reduce((a, s) => a + s.share_amount, 0) * 100) / 100;
  const toggle = (id: number) => {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };

  const settle = () => {
    transactionsAPI.settleSplits([...picked], { paid_for: `Settled with ${person.name}` });
    onDone();
  };

  return (
    <Sheet visible title={`Settle with ${person.name}`} onClose={onClose}>
      <Card>
        {splits.map((sp, i) => <PickRow key={sp.id} split={sp} first={i === 0} on={picked.has(sp.id)} onPress={() => toggle(sp.id)} />)}
      </Card>
      <Button
        label={net > 0 ? `${person.name} paid me ${inr(net)}` : net < 0 ? `I paid ${person.name} ${inr(-net)}` : picked.size ? 'Evens out, mark settled' : 'Nothing to settle'}
        onPress={settle}
        disabled={!picked.size}
      />
    </Sheet>
  );
}

function PickRow({ split, first, on, onPress }: { split: UnsettledSplit; first: boolean; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.pick, !first && s.pickDivider]}>
      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? color.positiveStrong : color.textTertiary} />
      <View style={{ flex: 1 }}>
        <Text style={s.pickTitle}>{split.paid_for || 'Split'}</Text>
        <Text style={s.pickSub}>{dayLabel(split.created_at.slice(0, 10), new Date())}</Text>
      </View>
      <Text style={[s.pickAmount, { color: split.share_amount > 0 ? color.positive : color.negative }]}>
        {split.share_amount > 0 ? '+' : '−'}{inr(Math.abs(split.share_amount))}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  pickDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.divider },
  pickTitle: { color: color.text, fontSize: 16, fontWeight: '500' },
  pickSub: { color: color.textSecondary, fontSize: 13, marginTop: 2 },
  pickAmount: { fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] }
});
