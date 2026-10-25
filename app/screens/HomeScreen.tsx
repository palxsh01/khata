import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as accountsAPI from '../db/accountsAPI';
import * as transactionsAPI from '../db/transactionsAPI';
import type { Transaction, TxType } from '../db/transactionsAPI';
import { color, radius, space } from '../theme';
import { Card, Chip, Empty, Hero, ListRow, Screen } from '../ui';
import { applyFilters, compact, dailyTotals, dayLabel, dayOf, groupByDay, inr, pctChange, total } from './activity';

const CHART_H = 200;
const TICKS = [1, 7, 14, 21, 28];

export default function HomeScreen() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const today = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const [pm, py] = month === 1 ? [12, year - 1] : [month - 1, year];

  const [type, setType] = useState<TxType>('expense');
  const [accountIdx, setAccountIdx] = useState(-1); // -1 = all accounts

  // ponytail: loaded once on mount; re-query on focus once the add sheet exists
  const { txs, prevTxs, accounts } = useMemo(() => ({
    txs: transactionsAPI.getByMonth(month, year),
    prevTxs: transactionsAPI.getByMonth(pm, py),
    accounts: accountsAPI.getAll()
  }), []);

  const accountId = accounts[accountIdx]?.id ?? null;
  const shown = applyFilters(txs, type, accountId);
  const sum = total(shown);
  // compare against the same stretch of last month, not the whole month
  const prevSum = total(applyFilters(prevTxs, type, accountId).filter((t) => dayOf(t) <= today));
  const pct = pctChange(sum, prevSum);
  const good = pct !== null && (type === 'expense' ? pct <= 0 : pct >= 0);
  const prevName = new Date(py, pm - 1).toLocaleDateString('en-IN', { month: 'short' });

  return (
    <Screen>
      <Hero
        label={type === 'expense' ? 'Spent this month' : 'Earned this month'}
        value={inr(sum, 0)}
        sub={pct !== null && (
          <View style={s.delta}>
            <Ionicons
              name={pct <= 0 ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={16}
              color={good ? color.positive : color.negative}
            />
            <Text style={[s.deltaText, { color: good ? color.positive : color.negative }]}>
              {Math.abs(pct)}% from {prevName}
            </Text>
          </View>
        )}
      />

      <DailyBars totals={dailyTotals(shown, daysInMonth)} today={today} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip
          label={type === 'expense' ? 'Expenses' : 'Income'}
          onPress={() => setType(type === 'expense' ? 'income' : 'expense')}
        />
        <Chip
          label={accounts[accountIdx]?.name ?? 'All accounts'}
          onPress={() => setAccountIdx(accountIdx + 1 < accounts.length ? accountIdx + 1 : -1)}
        />
      </ScrollView>

      {groupByDay(shown).map((g) => (
        <View key={g.date}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionText}>{dayLabel(g.date, now)}</Text>
            <Text style={s.sectionText}>{inr(g.total)}</Text>
          </View>
          <Card>
            {g.items.map((t, i) => <Row key={t.id} tx={t} first={i === 0} />)}
          </Card>
        </View>
      ))}

      {!shown.length && <Empty text={type === 'expense' ? 'No expenses this month' : 'No income this month'} />}
    </Screen>
  );
}

function DailyBars({ totals, today }: { totals: number[]; today: number }) {
  const max = Math.max(...totals, 1);
  const avg = totals.slice(0, today).reduce((a, b) => a + b, 0) / today;
  const avgY = (avg / max) * CHART_H;

  return (
    <View style={s.chart}>
      <View style={s.chartRow}>
        <View style={s.bars}>
          {totals.map((v, i) => (
            <View key={i} style={s.barSlot}>
              <View
                style={[
                  s.bar,
                  i + 1 > today
                    ? { height: CHART_H, backgroundColor: color.track, opacity: 0.35 }
                    : { height: Math.max((v / max) * CHART_H, 2), backgroundColor: v ? color.text : color.track }
                ]}
              />
            </View>
          ))}
          {avg > 0 && (
            <View style={[s.avgLine, { bottom: avgY }]}>
              {Array.from({ length: 48 }, (_, i) => <View key={i} style={s.dash} />)}
            </View>
          )}
        </View>
        <View style={s.axis}>
          <Text style={[s.axisText, { top: -8 }]}>{compact(max)}</Text>
          {avg > 0 && avgY < CHART_H - 20 && avgY > 20 && (
            <Text style={[s.axisText, { bottom: avgY - 8 }]}>{compact(avg)}</Text>
          )}
          <Text style={[s.axisText, { bottom: -8 }]}>0</Text>
        </View>
      </View>
      <View style={s.ticks}>
        {totals.map((_, i) => (
          <View key={i} style={s.barSlot}>
            {(TICKS.includes(i + 1) || i + 1 === totals.length) && <Text style={s.tickText}>{i + 1}</Text>}
          </View>
        ))}
        <View style={s.axis} />
      </View>
    </View>
  );
}

function Row({ tx, first }: { tx: Transaction; first: boolean }) {
  const title = tx.paid_for || (tx.type === 'income' ? 'Income' : 'Expense');
  const income = tx.type === 'income';

  return (
    <ListRow
      first={first}
      left={<View style={s.tile}><Text style={s.tileText}>{title[0].toUpperCase()}</Text></View>}
      title={title}
      tags={[...(tx.is_split ? ['split'] : []), ...(tx.paid_by !== 'me' ? [`paid by ${tx.paid_by}`] : [])]}
      right={`${income ? '+' : ''}${inr(tx.amount)}`}
      rightColor={income ? color.positive : undefined}
    />
  );
}

const s = StyleSheet.create({
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  deltaText: { fontSize: 14 },

  chart: { marginBottom: space.section },
  chartRow: { flexDirection: 'row', height: CHART_H },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 5, borderRadius: radius.full },
  avgLine: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  dash: { width: 3, height: 1, backgroundColor: color.textSecondary },
  axis: { width: 36 },
  axisText: { position: 'absolute', right: 0, color: color.textTertiary, fontSize: 12 },
  ticks: { flexDirection: 'row', marginTop: 8 },
  tickText: { width: 24, textAlign: 'center', color: color.textTertiary, fontSize: 12 },

  chips: { gap: 8, marginBottom: space.section },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  sectionText: { color: color.textTertiary, fontSize: 13 },

  tile: { width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  tileText: { color: color.text, fontSize: 16, fontWeight: '600' }
});
