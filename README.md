# Net Worth Tracker

A local-first dashboard for monthly net worth snapshots — no new spreadsheet each month.

## Why this vs a spreadsheet

- **One account list** — define Chase, 401k, etc. once; snapshots only store balances.
- **Automatic net worth** — assets and liabilities roll up correctly.
- **Trend + allocation charts** — see progress without rebuilding charts.
- **Insights** — emergency fund, debt vs cash, age-based checks (rules of thumb, not advice).

## Quick start

```bash
cd net-worth-tracker
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Monthly workflow

1. **Accounts** — add or archive accounts when life changes (new job, paid off card).
2. **Update** — once a month, enter balances (pre-filled from last snapshot).
3. **Dashboard** — review net worth, MoM change, allocation, and insights.
4. **Settings** — birth year, emergency fund months, optional allocation targets.

Data lives in `data/finance.json`. Back it up or commit it to a private repo.

## Replace sample data

Edit `data/finance.json` or use the UI. Delete the sample `snapshots` array and add your own via **Update**.

## Disclaimer

Insights are educational heuristics only, not financial, tax, or investment advice.
