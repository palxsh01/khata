import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as accountsAPI from '../db/accountsAPI';
import * as peopleAPI from '../db/peopleAPI';
import * as transactionsAPI from '../db/transactionsAPI';
import type { SplitInput, TxType } from '../db/transactionsAPI';
import { color, radius } from '../theme';
import { Button, Field, Options, Sheet, parseAmount, s as ui } from '../ui';
import { dayLabel, inr, isoDate, shares } from './activity';

export default function AddTransactionSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { accounts, people } = useMemo(() => ({ accounts: accountsAPI.getAll(), people: peopleAPI.getAll() }), []);
  const today = isoDate(new Date());

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [paidFor, setPaidFor] = useState('');
  const [date, setDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null);
  const [payer, setPayer] = useState<number | null>(null); // null = me
  const [picked, setPicked] = useState<Map<number, string>>(new Map()); // person -> typed share ('' = equal)
  const [mine, setMine] = useState(''); // my share when someone else paid ('' = all of it)

  const n = parseAmount(amount);
  const expense = type === 'expense';
  const payerName = people.find((p) => p.id === payer)?.name;
  const ids = [...picked.keys()];
  const typed = ids.map((id) => (picked.get(id)!.trim() ? parseAmount(picked.get(id)!) : null));
  const owed = shares(n > 0 ? n : 0, typed);

  let splits: SplitInput[] = [];
  let note = '';
  let splitOk = true;
  if (expense && payer !== null) {
    const m = mine.trim() ? parseAmount(mine) : n;
    splits = [{ person_id: payer, share_amount: -m }];
    splitOk = m > 0 && m <= n;
    note = splitOk ? `You owe ${payerName} ${inr(m)}` : `Your share must be between ₹0 and ${inr(n)}`;
  } else if (expense && ids.length) {
    const myShare = n - owed.reduce((a, x) => a + x, 0);
    splits = ids.map((person_id, i) => ({ person_id, share_amount: owed[i] }));
    splitOk = owed.every((x) => x > 0) && myShare > -0.005;
    note = splitOk ? `Your share ${inr(Math.max(myShare, 0))}` : 'Shares must be above ₹0 and add up to the amount or less';
  }
  const valid = n > 0 && splitOk;

  const toggle = (id: number) => {
    const next = new Map(picked);
    if (!next.delete(id)) next.set(id, '');
    setPicked(next);
  };

  const save = () => {
    if (!valid) return;
    transactionsAPI.create({
      amount: n,
      type,
      paid_for: paidFor.trim() || null,
      paid_by: expense && payerName ? payerName : 'me',
      account_id: expense && payer !== null ? null : accountId,
      // today keeps the db's exact IST time; other days are pinned to noon
      created_at: date === today ? undefined : `${date} 12:00:00`,
      splits: expense ? splits : []
    });
    onSaved();
  };

  return (
    <Sheet visible title="Add transaction" onClose={onClose}>
      <Options
        options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }]}
        isOn={(id) => id === type}
        onPress={(id) => setType(id as TxType)}
      />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" autoFocus />
      <Field label={expense ? 'What for' : 'From'} value={paidFor} onChangeText={setPaidFor} placeholder={expense ? 'Groceries' : 'Salary'} />

      <Label text="Date" />
      <Pressable onPress={() => setCalendarOpen(!calendarOpen)} style={[ui.input, s.dateRow]}>
        <Text style={s.dateText}>{dayLabel(date, new Date())}</Text>
        <Ionicons name={calendarOpen ? 'chevron-up' : 'calendar-outline'} size={18} color={color.textSecondary} />
      </Pressable>
      {calendarOpen && (
        <Calendar
          value={date}
          max={today}
          onPick={(d) => {
            setDate(d);
            setCalendarOpen(false);
          }}
        />
      )}

      {expense && people.length > 0 && (
        <>
          <Label text="Paid by" />
          <Options
            options={[{ id: null, label: 'Me' }, ...people.map((p) => ({ id: p.id, label: p.name }))]}
            isOn={(id) => id === payer}
            onPress={(id) => setPayer(id as number | null)}
          />

          {payer === null ? (
            <>
              <Label text="Split with" />
              <Options
                options={people.map((p) => ({ id: p.id, label: p.name }))}
                isOn={(id) => picked.has(id as number)}
                onPress={(id) => toggle(id as number)}
              />
              {ids.map((id, i) => (
                <Field
                  key={id}
                  label={`${people.find((p) => p.id === id)?.name} owes`}
                  value={picked.get(id)}
                  onChangeText={(t) => setPicked(new Map(picked).set(id, t))}
                  keyboardType="numeric"
                  placeholder={`${owed[i]} (equal)`}
                />
              ))}
            </>
          ) : (
            <Field
              label="Your share"
              value={mine}
              onChangeText={setMine}
              keyboardType="numeric"
              placeholder={n > 0 ? `${n} (all of it)` : 'All of it'}
            />
          )}
        </>
      )}

      {(!expense || payer === null) && accounts.length > 0 && (
        <>
          <Label text="Account" />
          <Options
            options={[...accounts.map((a) => ({ id: a.id, label: a.name })), { id: null, label: 'None' }]}
            isOn={(id) => id === accountId}
            onPress={(id) => setAccountId(id as number | null)}
          />
        </>
      )}

      {n > 0 && note !== '' && <Text style={[s.note, !splitOk && { color: color.negative }]}>{note}</Text>}

      <Button label="Save" onPress={save} disabled={!valid} />
    </Sheet>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// in-app month grid so picking a date stays in our look; days after `max` are disabled
function Calendar({ value, max, onPick }: { value: string; max: string; onPick: (date: string) => void }) {
  const [y, m] = value.split('-').map(Number);
  const [view, setView] = useState({ y, m }); // m is 1-12
  const first = new Date(view.y, view.m - 1, 1);
  const days = new Date(view.y, view.m, 0).getDate();
  const cells = [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const iso = (d: number) => isoDate(new Date(view.y, view.m - 1, d));
  const shift = (by: number) => {
    const d = new Date(view.y, view.m - 1 + by, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };
  const atMax = iso(1).slice(0, 7) >= max.slice(0, 7);

  return (
    <View style={s.calendar}>
      <View style={s.calHeader}>
        <Pressable onPress={() => shift(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={color.text} />
        </Pressable>
        <Text style={s.calTitle}>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={12} disabled={atMax}>
          <Ionicons name="chevron-forward" size={20} color={atMax ? color.textTertiary : color.text} />
        </Pressable>
      </View>
      <View style={s.grid}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={[s.cell, s.weekday]}>{w}</Text>)}
        {cells.map((d, i) => {
          if (d === null) return <View key={`x${i}`} style={s.cell} />;
          const date = iso(d);
          const on = date === value;
          const future = date > max;
          return (
            <Pressable key={date} onPress={() => onPick(date)} disabled={future} style={s.cell}>
              <View style={[s.day, on && s.dayOn, date === max && !on && s.dayToday]}>
                <Text style={[s.dayText, on && s.dayTextOn, future && { color: color.textTertiary }]}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const Label = ({ text }: { text: string }) => <Text style={s.label}>{text}</Text>;

const s = StyleSheet.create({
  label: { color: color.textSecondary, fontSize: 13, marginBottom: 6, marginLeft: 4 },
  note: { color: color.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 8 },

  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dateText: { color: color.text, fontSize: 16 },
  calendar: { backgroundColor: color.surfaceRaised, borderRadius: radius.tile, padding: 12, marginTop: -8, marginBottom: 16 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  calTitle: { color: color.text, fontSize: 15, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: color.textTertiary, fontSize: 12, textAlign: 'center', textAlignVertical: 'center' },
  day: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: color.fab },
  dayToday: { borderWidth: 1, borderColor: color.textSecondary },
  dayText: { color: color.text, fontSize: 14 },
  dayTextOn: { color: color.bg, fontWeight: '600' }
});
