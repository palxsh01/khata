import { useMemo, useReducer, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as budgetAPI from '../db/budgetAPI';
import { color } from '../theme';
import { Button, Card, Empty, Field, Header, ListRow, Ring, Screen, Sheet, parseAmount, s as ui } from '../ui';
import { inr } from './activity';

export default function BudgetScreen() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const [v, reload] = useReducer((x: number) => x + 1, 0);
  const status = useMemo(() => budgetAPI.getByMonth(month, year), [v]);
  const [holding, setHolding] = useState(false);
  const [draft, setDraft] = useState<string | null>(null); // null = sheet closed

  const save = () => {
    const n = parseAmount(draft ?? '');
    if (!(n > 0)) return;
    if (status) budgetAPI.update(status.id, n);
    else budgetAPI.create(month, year, n);
    setDraft(null);
    reload();
  };

  const shown = status ? (holding ? status.projected : status.remaining) : 0;
  const over = shown < 0;

  return (
    <Screen>
      <Header title={monthName} icon="pencil" onPress={() => setDraft(status ? String(status.budget) : '')} />

      {status ? (
        <>
          <Pressable
            style={s.ringWrap}
            onLongPress={() => setHolding(true)}
            onPressOut={() => setHolding(false)}
            delayLongPress={200}
          >
            <Ring size={280} stroke={18} progress={over ? 1 : shown / status.budget} tint={over ? color.negative : color.text}>
              <Text style={ui.label}>
                {holding ? 'After splits clear' : over ? 'Over budget by' : 'Left this month'}
              </Text>
              <Text style={[ui.heroNumber, over && { color: color.negative }]}>{inr(Math.abs(shown), 0)}</Text>
              <Text style={ui.label}>of {inr(status.budget, 0)}</Text>
            </Ring>
          </Pressable>
          <Text style={s.hint}>Hold the ring to see where you land once splits clear</Text>

          <Card>
            <ListRow first left={null} title="Budget" right={inr(status.budget, 0)} />
            <ListRow
              first={false}
              left={null}
              title="Remaining"
              right={inr(status.remaining, 0)}
              rightColor={status.remaining < 0 ? color.negative : undefined}
            />
            <ListRow
              first={false}
              left={null}
              title="Pending splits"
              sub={status.pending >= 0 ? 'Net coming back to you' : 'Net you still owe'}
              right={`${status.pending > 0 ? '+' : ''}${inr(status.pending, 0)}`}
              rightColor={status.pending > 0 ? color.positive : status.pending < 0 ? color.negative : undefined}
            />
            <ListRow first={false} left={null} title="Projected" right={inr(status.projected, 0)} />
          </Card>
        </>
      ) : (
        <>
          <Empty text={`No budget set for ${monthName}`} />
          <Button label="Set budget" onPress={() => setDraft('')} />
        </>
      )}

      <Sheet visible={draft !== null} title={`Budget for ${monthName}`} onClose={() => setDraft(null)}>
        <Field label="Amount" value={draft ?? ''} onChangeText={setDraft} keyboardType="numeric" placeholder="30000" autoFocus />
        <Button label="Save" onPress={save} disabled={!(parseAmount(draft ?? '') > 0)} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  ringWrap: { alignItems: 'center', marginTop: 8 },
  hint: { color: color.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 24 }
});
