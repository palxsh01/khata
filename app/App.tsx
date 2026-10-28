import { useReducer, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { seed } from './db/devSeed';
import AddTransactionSheet from './screens/AddTransactionSheet';
import AccountsScreen from './screens/AccountsScreen';
import BudgetScreen from './screens/BudgetScreen';
import HomeScreen from './screens/HomeScreen';
import PeopleScreen from './screens/PeopleScreen';
import { color, radius } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS = [
  { key: 'activity', label: 'Activity', icon: 'reader', Screen: HomeScreen },
  { key: 'budget', label: 'Budget', icon: 'pie-chart', Screen: BudgetScreen },
  { key: 'people', label: 'People', icon: 'people', Screen: PeopleScreen },
  { key: 'accounts', label: 'Accounts', icon: 'wallet', Screen: AccountsScreen }
] as const satisfies readonly { key: string; label: string; icon: IconName; Screen: () => React.JSX.Element }[];

export default function App() {
  const [active, setActive] = useState(0);
  // bumping the key remounts the screen, which re-queries the db
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const [adding, setAdding] = useState(false);
  const { Screen } = TABS[active];

  const resetWithSample = () =>
    Alert.alert('Reset with sample data?', 'This wipes everything in the local database.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          seed();
          bump();
        }
      }
    ]);

  return (
    <View style={s.root}>
      <Screen key={`${active}-${version}`} />

      {/* DEV ONLY: stripped from release builds by the __DEV__ guard */}
      {__DEV__ && (
        <Pressable style={s.dev} onPress={resetWithSample}>
          <Ionicons name="flask" size={18} color={color.textSecondary} />
        </Pressable>
      )}

      <Pressable onPress={() => setAdding(true)} style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.92 }] }]}>
        <Ionicons name="add" size={28} color={color.bg} />
      </Pressable>

      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <Pressable key={t.key} onPress={() => setActive(i)} style={[s.tab, i === active && s.tabActive]}>
            <Ionicons name={t.icon} size={20} color={i === active ? color.text : color.textSecondary} />
            <Text style={[s.tabLabel, i === active && { color: color.text }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {adding && (
        <AddTransactionSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            bump();
          }}
        />
      )}

      <StatusBar style="light" />
    </View>
  );
}

// ponytail: fixed bottom offset clears gesture nav; use safe-area insets if 3-button nav overlaps
const BAR_BOTTOM = 28;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  tabBar: {
    position: 'absolute', left: 20, right: 20, bottom: BAR_BOTTOM, height: 64,
    flexDirection: 'row', alignItems: 'center', padding: 6,
    backgroundColor: 'rgba(42, 47, 50, 0.92)', borderRadius: radius.full
  },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, gap: 2 },
  tabActive: { backgroundColor: color.surfaceRaised },
  tabLabel: { color: color.textSecondary, fontSize: 11 },
  fab: {
    position: 'absolute', right: 20, bottom: BAR_BOTTOM + 64 + 16, width: 56, height: 56,
    borderRadius: radius.full, backgroundColor: color.fab, alignItems: 'center', justifyContent: 'center', elevation: 6
  },
  dev: {
    position: 'absolute', left: 20, top: (RNStatusBar.currentHeight ?? 0) + 28, width: 40, height: 40,
    borderRadius: radius.full, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center'
  }
});
