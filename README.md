# khata

Local-only Android ledger / expense-splitting app. React Native (Expo) + SQLite (`expo-sqlite`). No backend, no network calls.

## Features

- Log expenses and income against an account.
- Splitwise-style splits (equal or unequal) with people from a dropdown.
- Manual settlement: pick which unsettled splits a repayment covers; the repayment is its own transaction row. Deleting that transaction reopens the splits.
- Monthly budget with remaining / overspend, plus a press-and-hold view of remaining budget once all outstanding splits clear.
- Account balances computed from transactions, never mutated in place.

## Run

```sh
cd app
pnpm install
pnpm start      # or: pnpm android
```

## Docs

See [ARCHITECTURE.md](ARCHITECTURE.md) for layout and data flow.
