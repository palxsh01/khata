import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as accountsAPI from '../db/accountsAPI';
import * as transactionsAPI from '../db/transactionsAPI';
import type { Transaction, TxType } from '../db/transactionsAPI';
import { color, radius, space } from '../theme';
import { Card, Chip, Empty, Hero, ListRow, Options, RoundButton, Screen } from '../ui';
import {
  applyFilters, bucketTotals, compact, dayBuckets, dayLabel, dayOf, groupByDay, inr, isoDate, monthBuckets, pctChange,
  total, weekBuckets, type Bucket
} from './activity';

const CHART_H = 200;

type Range = 'month' | '3m' | '1y' | 'all';
const RANGES = [
  { id: 'month', label: 'Month' },
  { id: '3m', label: '3M' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'Lifetime' }
];

export default function HomeScreen() {
  const now = new Date();
  const today = isoDate(now);
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  // [year, month] `back` months before this one
  const ym = (back: number) => {
    const d = new Date(cy, cm - 1 - back, 1);
    return [d.getFullYear(), d.getMonth() + 1] as const;
  };
  const monthName = (y: number, m: number) => new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const [type, setType] = useState<TxType>('expense');
  const [accountIdx, setAccountIdx] = useState(-1); // -1 = all accounts
  const [range, setRange] = useState<Range>('month');
  const [monthBack, setMonthBack] = useState(0); // Month view: 0 = this month
  const [year, setYear] = useState<number | null>(null); // 1Y view: null = last 12 months

  // ponytail: every transaction loaded once per mount (App remounts after adds); query per range if this gets slow
  // getAll(-1): SQLite reads LIMIT -1 as no limit
  const { all, accounts } = useMemo(() => ({ all: transactionsAPI.getAll(-1), accounts: accountsAPI.getAll() }), []);
  const [fy, fm] = (all[all.length - 1]?.created_at ?? today).split('-').map(Number);

  let buckets: Bucket[];
  let end = isoDate(new Date(cy, cm, 1)); // start of next month
  let phrase: string;
  if (range === 'month') {
    const [y, m] = ym(monthBack);
    buckets = dayBuckets(y, m);
    end = isoDate(new Date(y, m, 1));
    phrase = monthBack ? `in ${monthName(y, m)}` : 'this month';
  } else if (range === '3m') {
    buckets = weekBuckets(isoDate(new Date(cy, cm - 3, 1)), end);
    phrase = 'in the last 3 months';
  } else if (range === '1y' && year !== null) {
    buckets = monthBuckets(year, 1, 12);
    end = `${year + 1}-01-01`;
    phrase = `in ${year}`;
  } else if (range === '1y') {
    buckets = monthBuckets(...ym(11), 12);
    phrase = 'in the last 12 months';
  } else {
    buckets = monthBuckets(fy, fm, (cy - fy) * 12 + cm - fm + 1);
    phrase = `since ${new Date(fy, fm - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
  }
  const start = buckets[0].start;
  const inRange = (t: Transaction) => t.created_at >= start && t.created_at < end;

  const accountId = accounts[accountIdx]?.id ?? null;
  const shown = applyFilters(all.filter(inRange), type, accountId);
  const sum = total(shown);

  // only Month compares: this month against the same days of the last, past months whole
  const [py, pm] = ym(monthBack + 1);
  let pct: number | null = null;
  if (range === 'month') {
    const prev = all.filter((t) => t.created_at >= isoDate(new Date(py, pm - 1, 1)) && t.created_at < start);
    const cutoff = monthBack ? 31 : now.getDate();
    pct = pctChange(sum, total(applyFilters(prev, type, accountId).filter((t) => dayOf(t) <= cutoff)));
  }
  const good = pct !== null && (type === 'expense' ? pct <= 0 : pct >= 0);
  const prevName = new Date(py, pm - 1).toLocaleDateString('en-IN', { month: 'short' });

  const years = Array.from({ length: cy - fy + 1 }, (_, i) => cy - i);

  return (
    <Screen>
      <View style={s.rangeRow}>
        <Options options={RANGES} isOn={(id) => id === range} onPress={(id) => setRange(id as Range)} />
      </View>

      {range === 'month' && (
        <View style={s.monthNav}>
          <RoundButton icon="chevron-back" onPress={() => setMonthBack(monthBack + 1)} />
          <Text style={s.monthText}>{monthName(...ym(monthBack))}</Text>
          {monthBack ? <RoundButton icon="chevron-forward" onPress={() => setMonthBack(monthBack - 1)} /> : <View style={s.navSpacer} />}
        </View>
      )}
      {range === '1y' && (
        <View style={s.rangeRow}>
          <Options
            options={[{ id: null, label: 'Last 12 months' }, ...years.map((y) => ({ id: y, label: String(y) }))]}
            isOn={(id) => id === year}
            onPress={(id) => setYear(id as number | null)}
          />
        </View>
      )}

      <Hero
        label={`${type === 'expense' ? 'Spent' : 'Earned'} ${phrase}`}
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

      <Bars totals={bucketTotals(shown, buckets)} buckets={buckets} upTo={buckets.filter((b) => b.start <= today).length} />

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

      {!shown.length && <Empty text={`No ${type === 'expense' ? 'expenses' : 'income'} ${phrase}`} />}
    </Screen>
  );
}

// bars after `upTo` haven't happened yet and are drawn as ghosts
function Bars({ totals, buckets, upTo }: { totals: number[]; buckets: Bucket[]; upTo: number }) {
  const max = Math.max(...totals, 1);
  const avg = totals.slice(0, upTo).reduce((a, b) => a + b, 0) / Math.max(upTo, 1);
  const avgY = (avg / max) * CHART_H;
  const width = totals.length > 16 ? 5 : 12;

  return (
    <View style={s.chart}>
      <View style={s.chartRow}>
        <View style={s.bars}>
          {totals.map((v, i) => (
            <View key={i} style={s.barSlot}>
              <View
                style={[
                  s.bar,
                  { width },
                  i >= upTo
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
        {buckets.map((b) => (
          <View key={b.start} style={s.barSlot}>
            {b.label !== '' && <Text style={s.tickText} numberOfLines={1}>{b.label}</Text>}
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
  rangeRow: { alignItems: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthText: { color: color.text, fontSize: 16, fontWeight: '600' },
  navSpacer: { width: 48 },

  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  deltaText: { fontSize: 14 },

  chart: { marginBottom: space.section },
  chartRow: { flexDirection: 'row', height: CHART_H },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderRadius: radius.full },
  avgLine: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  dash: { width: 3, height: 1, backgroundColor: color.textSecondary },
  axis: { width: 36 },
  axisText: { position: 'absolute', right: 0, color: color.textTertiary, fontSize: 12 },
  ticks: { flexDirection: 'row', marginTop: 8 },
  tickText: { width: 40, textAlign: 'center', color: color.textTertiary, fontSize: 12 },

  chips: { gap: 8, marginBottom: space.section },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  sectionText: { color: color.textTertiary, fontSize: 13 },

  tile: { width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  tileText: { color: color.text, fontSize: 16, fontWeight: '600' }
});
