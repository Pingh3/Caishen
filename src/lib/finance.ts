import type {
  Account,
  AccountCategory,
  CategoryTotals,
  FinanceData,
  Insight,
  Snapshot,
} from "./types";

export const CATEGORY_LABELS: Record<AccountCategory, string> = {
  cash: "Cash",
  investments: "Investments",
  retirement: "CPF & SRS",
  property: "Property",
  other_asset: "Other assets",
  liability: "Liabilities",
};

export const SG_ACCOUNT_PRESETS = [
  { name: "DBS — Savings", category: "cash" as const },
  { name: "OCBC — Savings", category: "cash" as const },
  { name: "UOB — Savings", category: "cash" as const },
  { name: "CPF Ordinary Account (OA)", category: "retirement" as const },
  { name: "CPF Special Account (SA)", category: "retirement" as const },
  { name: "CPF MediSave", category: "retirement" as const, notes: "Illiquid" },
  { name: "SRS", category: "retirement" as const },
  { name: "Moomoo", category: "investments" as const, notes: "Stocks & ETFs" },
  { name: "Syfe", category: "investments" as const, notes: "Robo / portfolios" },
  { name: "Endowus", category: "investments" as const, notes: "Funds & CPF/SRS" },
  { name: "Property equity", category: "property" as const },
  { name: "Mortgage / HDB loan", category: "liability" as const, isLiability: true },
  { name: "Credit card", category: "liability" as const, isLiability: true },
];

export const CATEGORY_ORDER: AccountCategory[] = [
  "cash",
  "investments",
  "retirement",
  "property",
  "other_asset",
  "liability",
];

export function formatCurrency(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1_000_000) {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Per-unit trade prices in listing currency (always 2 dp). */
export function formatTradePrice(
  n: number,
  market: "US" | "SG",
): string {
  const opts = {
    style: "currency" as const,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  if (market === "US") {
    return new Intl.NumberFormat("en-US", { ...opts, currency: "USD" }).format(
      n,
    );
  }
  return new Intl.NumberFormat("en-SG", { ...opts, currency: "SGD" }).format(n);
}

export function formatPercent(n: number, signed = false): string {
  const prefix = signed && n > 0 ? "+" : "";
  return `${prefix}${n.toFixed(1)}%`;
}

export function signedBalance(account: Account, raw: number): number {
  const amount = account.isLiability ?? account.category === "liability"
    ? -Math.abs(raw)
    : raw;
  return amount;
}

export function snapshotNetWorth(
  snapshot: Snapshot,
  accounts: Account[],
): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return Object.entries(snapshot.balances).reduce((sum, [id, raw]) => {
    const account = byId.get(id);
    if (!account || account.archived) return sum;
    return sum + signedBalance(account, raw);
  }, 0);
}

export function categoryTotals(
  snapshot: Snapshot,
  accounts: Account[],
): CategoryTotals {
  const totals: CategoryTotals = {
    cash: 0,
    investments: 0,
    retirement: 0,
    property: 0,
    other_asset: 0,
    liability: 0,
  };
  const byId = new Map(accounts.map((a) => [a.id, a]));

  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = byId.get(id);
    if (!account || account.archived) continue;
    totals[account.category] += signedBalance(account, raw);
  }
  return totals;
}

export function investableAssets(totals: CategoryTotals): number {
  return (
    totals.cash +
    totals.investments +
    totals.retirement +
    totals.other_asset
  );
}

export function sortSnapshots(snapshots: Snapshot[]): Snapshot[] {
  return [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export function latestSnapshot(data: FinanceData): Snapshot | null {
  const sorted = sortSnapshots(data.snapshots);
  return sorted.at(-1) ?? null;
}

/** Merge balances into the latest snapshot, or create one for today. */
export function upsertLatestBalances(
  data: FinanceData,
  balances: Record<string, number>,
): FinanceData {
  const today = new Date().toISOString().slice(0, 10);
  const latest = latestSnapshot(data);
  const targetDate = latest?.date ?? today;
  const targetId = latest?.id ?? targetDate;

  const mergedBalances = { ...(latest?.balances ?? {}) };
  for (const [id, val] of Object.entries(balances)) {
    if (!Number.isNaN(val)) mergedBalances[id] = val;
  }

  const snapshot: Snapshot = {
    id: targetId,
    date: targetDate,
    balances: mergedBalances,
    monthlyExpenses: latest?.monthlyExpenses,
    notes: latest?.notes,
  };

  const others = data.snapshots.filter((s) => s.id !== targetId);
  return {
    ...data,
    snapshots: [...others, snapshot].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  };
}

export function previousSnapshot(
  data: FinanceData,
  current: Snapshot,
): Snapshot | null {
  const sorted = sortSnapshots(data.snapshots);
  const idx = sorted.findIndex((s) => s.id === current.id);
  return idx > 0 ? sorted[idx - 1] : null;
}

export function monthOverMonthChange(
  current: number,
  previous: number | null,
): { delta: number; percent: number | null } {
  if (previous === null || previous === 0) {
    return { delta: current - (previous ?? 0), percent: null };
  }
  return {
    delta: current - previous,
    percent: ((current - previous) / Math.abs(previous)) * 100,
  };
}

export function buildAllocationSlices(
  items: { category: AccountCategory; value: number }[],
): { category: AccountCategory; value: number; name: string }[] {
  return items
    .filter((x) => x.value > 0)
    .map((x) => ({
      ...x,
      name: CATEGORY_LABELS[x.category],
    }));
}

export function allocationPercents(
  totals: CategoryTotals,
): { category: AccountCategory; value: number; percent: number }[] {
  const investable = investableAssets(totals);
  const assetCategories: AccountCategory[] = [
    "cash",
    "investments",
    "retirement",
    "property",
    "other_asset",
  ];
  if (investable <= 0) return [];

  return assetCategories
    .map((category) => ({
      category,
      value: Math.max(0, totals[category]),
      percent:
        category === "property"
          ? (Math.max(0, totals.property) /
              (investable + Math.max(0, totals.property))) *
            100
          : (Math.max(0, totals[category]) / investable) * 100,
    }))
    .filter((x) => x.value > 0);
}

export function generateInsights(data: FinanceData): Insight[] {
  const insights: Insight[] = [];
  const latest = latestSnapshot(data);
  if (!latest) return insights;

  const accounts = data.accounts.filter((a) => !a.archived);
  const totals = categoryTotals(latest, accounts);
  const netWorth = snapshotNetWorth(latest, accounts);
  const prev = previousSnapshot(data, latest);
  const prevNw = prev ? snapshotNetWorth(prev, accounts) : null;
  const { percent: momPct } = monthOverMonthChange(netWorth, prevNw);

  const emergencyMonths = data.settings?.emergencyFundMonths ?? 6;
  const monthlyExpenses = latest.monthlyExpenses;
  const cashPositive = Math.max(0, totals.cash);
  const liabilities = Math.abs(totals.liability);

  if (monthlyExpenses && monthlyExpenses > 0) {
    const monthsCovered = cashPositive / monthlyExpenses;
    if (monthsCovered < emergencyMonths) {
      insights.push({
        id: "emergency-fund",
        severity: monthsCovered < 3 ? "action" : "watch",
        title: "Build your emergency fund",
        body: `Cash covers about ${monthsCovered.toFixed(1)} months of expenses. Target ${emergencyMonths} months (${formatCurrency(monthlyExpenses * emergencyMonths)}) before aggressive investing.`,
      });
    } else if (monthsCovered > emergencyMonths + 3) {
      insights.push({
        id: "cash-drag",
        severity: "info",
        title: "Excess cash",
        body: `You hold ~${monthsCovered.toFixed(0)} months of expenses in cash. Consider moving surplus above ${emergencyMonths} months into investments or debt payoff.`,
      });
    }
  } else {
    insights.push({
      id: "add-expenses",
      severity: "info",
      title: "Add monthly expenses",
      body: "Enter typical monthly spending on Update (or Accounts) to unlock emergency-fund and projection insights.",
    });
  }

  const monthlyIncome = data.settings?.monthlyIncome;
  if (!monthlyIncome || monthlyIncome <= 0) {
    insights.push({
      id: "add-income",
      severity: "info",
      title: "Add income for projections",
      body: "Set gross monthly income in Settings to see estimated savings and future net worth on the dashboard.",
    });
  } else if (monthlyExpenses && monthlyExpenses > 0) {
    const savings = monthlyIncome + (data.settings?.annualBonus ?? 0) / 12 - monthlyExpenses;
    if (savings > 0) {
      insights.push({
        id: "savings-rate",
        severity: "info",
        title: "Estimated monthly savings",
        body: `About ${formatCurrency(savings)}/month after expenses (${formatPercent((savings / monthlyIncome) * 100)} of gross income). Projections on the dashboard assume you invest this surplus.`,
      });
    }
  }

  if (liabilities > 0 && liabilities > cashPositive * 0.5) {
    insights.push({
      id: "debt-load",
      severity: liabilities > cashPositive ? "action" : "watch",
      title: "Debt vs liquid cash",
      body: `Liabilities (${formatCurrency(liabilities)}) ${liabilities > cashPositive ? "exceed" : "are a significant share of"} your liquid cash (${formatCurrency(cashPositive)}). Prioritize high-interest debt before new risk assets.`,
    });
  }

  const investable = investableAssets(totals);
  const growthPct =
    investable > 0
      ? ((totals.investments + totals.retirement) / investable) * 100
      : 0;
  const cashPct = investable > 0 ? (cashPositive / investable) * 100 : 0;

  const cpfTotal = Math.max(0, totals.retirement);
  if (cpfTotal > 0 && cpfTotal > investable * 0.7 && investable > 100_000) {
    insights.push({
      id: "cpf-concentration",
      severity: "info",
      title: "CPF-heavy balance sheet",
      body: `CPF & SRS are ${((cpfTotal / netWorth) * 100).toFixed(0)}% of net worth. Remember OA can fund housing while SA builds retirement — plan liquidity outside CPF for emergencies.`,
    });
  }

  if (growthPct < 50 && netWorth > 80_000) {
    insights.push({
      id: "growth-allocation",
      severity: "watch",
      title: "Growth allocation is light",
      body: `Only ${growthPct.toFixed(0)}% of investable assets are in investments + CPF/SRS (excluding OA used for property). Consider SRS or taxable ETFs if your horizon is 10+ years.`,
    });
  }

  if (cashPct > 25 && investable > 40_000) {
    insights.push({
      id: "high-cash",
      severity: "info",
      title: "High cash weight",
      body: `${cashPct.toFixed(0)}% of investable assets sit in cash. Fine for near-term goals; otherwise consider DCA into diversified ETFs (e.g. VWRA, ES3).`,
    });
  }

  const birthYear = data.settings?.birthYear;
  if (birthYear) {
    const age = new Date().getFullYear() - birthYear;
    const stockTarget = Math.min(90, Math.max(50, 110 - age));
    const equityLike =
      investable > 0
        ? ((totals.investments + totals.retirement) / investable) * 100
        : 0;
    if (equityLike < stockTarget - 15) {
      insights.push({
        id: "age-rule",
        severity: "info",
        title: "Age-based allocation check",
        body: `Rule-of-thumb for age ${age}: ~${stockTarget}% in growth assets. You're around ${equityLike.toFixed(0)}% in investments + CPF/SRS (investable only). CPF SA/RSTU and SRS count toward long-term growth.`,
      });
    }
  }

  if (momPct !== null && momPct < -5) {
    insights.push({
      id: "drawdown",
      severity: "info",
      title: "Recent dip",
      body: `Net worth fell ${formatPercent(Math.abs(momPct))} since last snapshot. Review whether this is market noise, spending, or a category worth rebalancing.`,
    });
  }

  if (momPct !== null && momPct > 8) {
    insights.push({
      id: "surge",
      severity: "info",
      title: "Strong month",
      body: `Net worth grew ${formatPercent(momPct)} month-over-month. Good time to confirm allocation still matches goals rather than letting drift run.`,
    });
  }

  const targets = data.allocationTargets;
  if (targets && investable > 0) {
    for (const cat of ["investments", "retirement", "cash"] as AccountCategory[]) {
      const target = targets[cat];
      if (target === undefined) continue;
      const actual =
        cat === "cash"
          ? (cashPositive / investable) * 100
          : (Math.max(0, totals[cat]) / investable) * 100;
      const diff = actual - target;
      if (Math.abs(diff) > 8) {
        insights.push({
          id: `target-${cat}`,
          severity: "watch",
          title: `${CATEGORY_LABELS[cat]} off target`,
          body: `Target ${target}% vs actual ${actual.toFixed(0)}%. Rebalance or update targets in Settings if your plan changed.`,
        });
      }
    }
  }

  return insights;
}
