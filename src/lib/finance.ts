import { AMOUNT_MASK } from "./privacy";
import type {
  Account,
  AccountCategory,
  CategoryTotals,
  FinanceData,
  Insight,
  InsurancePolicy,
  PersonalLoan,
  PropertyProfile,
  Snapshot,
  VehicleProfile,
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
  { name: "Property equity", category: "property" as const },
  { name: "Market Funds", category: "investments" as const, notes: "Funds / ETFs (manual)" },
  { name: "Mortgage / HDB loan", category: "liability" as const, isLiability: true },
  { name: "Car loan", category: "liability" as const, isLiability: true },
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

/** Always present once missing from saved data (e.g. after deploy). */
export const CORE_ACCOUNTS: Account[] = [
  {
    id: "market-funds",
    name: "Market Funds",
    category: "investments",
    notes: "Funds / ETFs (manual)",
  },
  {
    id: "car-loan",
    name: "Car loan",
    category: "liability",
    isLiability: true,
  },
];

export function ensureCoreAccounts(data: FinanceData): FinanceData {
  const accounts = [...data.accounts];
  let added = false;

  for (const core of CORE_ACCOUNTS) {
    const exists = accounts.some(
      (a) =>
        !a.archived &&
        (a.id === core.id ||
          a.name.trim().toLowerCase() === core.name.toLowerCase()),
    );
    if (!exists) {
      accounts.push(core);
      added = true;
    }
  }

  return added ? { ...data, accounts } : data;
}

export function formatCurrency(
  n: number,
  compact = false,
  hide = false,
): string {
  if (hide) return AMOUNT_MASK;
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

export function formatUsd(n: number, hide = false): string {
  if (hide) return AMOUNT_MASK;
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
  market: "US" | "SG" | "HK",
  hide = false,
): string {
  if (hide) return AMOUNT_MASK;
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
  if (market === "HK") {
    return new Intl.NumberFormat("en-HK", { ...opts, currency: "HKD" }).format(
      n,
    );
  }
  return new Intl.NumberFormat("en-SG", { ...opts, currency: "SGD" }).format(n);
}

export function formatPercent(n: number, signed = false, hide = false): string {
  if (hide) return AMOUNT_MASK;
  const prefix = signed && n > 0 ? "+" : "";
  return `${prefix}${n.toFixed(1)}%`;
}

export function signedBalance(account: Account, raw: number): number {
  const amount = account.isLiability ?? account.category === "liability"
    ? -Math.abs(raw)
    : raw;
  return amount;
}

export function insuranceTotal(policies: InsurancePolicy[] | undefined): number {
  return (policies ?? [])
    .filter((p) => !p.archived)
    .reduce((sum, p) => sum + (p.surrenderValue ?? 0), 0);
}

export function personalLoansTotal(loans: PersonalLoan[] | undefined): number {
  return (loans ?? [])
    .filter((l) => !l.archived)
    .reduce((sum, l) => sum + (l.principalOutstanding ?? 0), 0);
}

export function vehicleValue(vehicle: VehicleProfile | undefined): number {
  if (!vehicle || vehicle.estimatedValue <= 0) return 0;
  return vehicle.estimatedValue;
}

/** Car loan balance from latest snapshot (Car loan liability account). */
export function carLoanOwed(snapshot: Snapshot, accounts: Account[]): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let total = 0;
  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = byId.get(id);
    if (!account || account.archived || account.category !== "liability") {
      continue;
    }
    if (!/car/i.test(account.name)) continue;
    total += Math.abs(signedBalance(account, raw));
  }
  return total;
}

export function vehicleEquity(
  vehicle: VehicleProfile | undefined,
  snapshot: Snapshot,
  accounts: Account[],
): number {
  return vehicleValue(vehicle) - carLoanOwed(snapshot, accounts);
}

export function isPropertyLinkedLiability(account: Account): boolean {
  if (account.category !== "liability") return false;
  const n = account.name.toLowerCase();
  return (
    /mortgage|hdb|bank loan|housing loan|home loan/.test(n) && !/car/.test(n)
  );
}

export function propertyBalanceSum(
  snapshot: Snapshot,
  accounts: Account[],
): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let total = 0;
  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = byId.get(id);
    if (!account || account.archived || account.category !== "property") {
      continue;
    }
    total += Math.max(0, signedBalance(account, raw));
  }
  return total;
}

/** Mortgage / HDB loan balance from snapshot, or property profile fallback. */
export function mortgageOwed(
  snapshot: Snapshot,
  accounts: Account[],
  profile?: PropertyProfile,
): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let fromSnapshot = 0;
  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = byId.get(id);
    if (!account || account.archived || !isPropertyLinkedLiability(account)) {
      continue;
    }
    fromSnapshot += Math.abs(signedBalance(account, raw));
  }
  if (fromSnapshot > 0) return fromSnapshot;
  return profile?.mortgageOutstanding ?? 0;
}

const PROPERTY_VALUE_TOLERANCE = 5000;

function profileGrossValue(profile: PropertyProfile): number | null {
  if (profile.manualValue !== undefined && profile.manualValue > 0) {
    return profile.manualValue;
  }
  if (profile.estimatedValue !== undefined && profile.estimatedValue > 0) {
    return profile.estimatedValue;
  }
  return null;
}

/**
 * Property account holds net equity (not gross value) while mortgage is also on
 * the snapshot — exclude the mortgage from net worth to avoid double-counting.
 */
export function propertySnapshotIsNetEquity(
  snapshot: Snapshot,
  accounts: Account[],
  profile?: PropertyProfile,
): boolean {
  const prop = propertyBalanceSum(snapshot, accounts);
  const mort = mortgageOwed(snapshot, accounts, profile);
  if (prop <= 0) return false;
  if (mort <= 0) return true;

  const propertyAccounts = accounts.filter(
    (a) => !a.archived && a.category === "property",
  );
  if (propertyAccounts.some((a) => /equity/i.test(a.name))) return true;

  const gross = profile ? profileGrossValue(profile) : null;
  if (gross !== null) {
    const tol = Math.max(PROPERTY_VALUE_TOLERANCE, gross * 0.02);
    if (Math.abs(prop - (gross - mort)) <= tol) return true;
    if (Math.abs(prop - gross) <= tol) return false;
  }

  return prop < mort;
}

export function propertyGrossValue(
  snapshot: Snapshot,
  accounts: Account[],
  profile?: PropertyProfile,
): number {
  const prop = propertyBalanceSum(snapshot, accounts);
  const mort = mortgageOwed(snapshot, accounts, profile);
  if (propertySnapshotIsNetEquity(snapshot, accounts, profile)) {
    return prop + mort;
  }
  const fromProfile = profile ? profileGrossValue(profile) : null;
  if (fromProfile !== null) return fromProfile;
  return prop;
}

/** Property contribution to net worth (market value minus outstanding loan). */
export function propertyNetEquity(
  snapshot: Snapshot,
  accounts: Account[],
  profile?: PropertyProfile,
): number {
  const prop = propertyBalanceSum(snapshot, accounts);
  const mort = mortgageOwed(snapshot, accounts, profile);
  if (propertySnapshotIsNetEquity(snapshot, accounts, profile)) return prop;
  return prop - mort;
}

function accountBalanceSum(
  snapshot: Snapshot,
  accounts: Account[],
  excludeCategories?: AccountCategory[],
  includeAccount?: (account: Account) => boolean,
): number {
  const exclude = new Set(excludeCategories ?? []);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return Object.entries(snapshot.balances).reduce((sum, [id, raw]) => {
    const account = byId.get(id);
    if (!account || account.archived) return sum;
    if (exclude.has(account.category)) return sum;
    if (includeAccount && !includeAccount(account)) return sum;
    return sum + signedBalance(account, raw);
  }, 0);
}

/** Accounts excluded from liquid net worth (illiquid / tied to property). */
export function isLiquidSnapshotAccount(account: Account): boolean {
  if (account.category === "retirement" || account.category === "property") {
    return false;
  }
  if (isPropertyLinkedLiability(account)) return false;
  return true;
}

function liquidAccountBalanceSum(
  snapshot: Snapshot,
  accounts: Account[],
): number {
  return accountBalanceSum(snapshot, accounts, [], isLiquidSnapshotAccount);
}

/** Full net worth including insurance surrender values. */
export function snapshotNetWorth(
  snapshot: Snapshot,
  accounts: Account[],
  insurancePolicies?: InsurancePolicy[],
  personalLoans?: PersonalLoan[],
  vehicle?: VehicleProfile,
  property?: PropertyProfile,
): number {
  let sum =
    accountBalanceSum(snapshot, accounts) +
    insuranceTotal(insurancePolicies) +
    personalLoansTotal(personalLoans) +
    vehicleValue(vehicle);
  if (propertySnapshotIsNetEquity(snapshot, accounts, property)) {
    sum += mortgageOwed(snapshot, accounts, property);
  }
  return sum;
}

/** Net worth excluding CPF/SRS, property equity, and property-linked loans. */
export function snapshotLiquidNetWorth(
  snapshot: Snapshot,
  accounts: Account[],
  insurancePolicies?: InsurancePolicy[],
  personalLoans?: PersonalLoan[],
): number {
  return (
    liquidAccountBalanceSum(snapshot, accounts) +
    insuranceTotal(insurancePolicies) +
    personalLoansTotal(personalLoans)
  );
}

/** Cash + investments only (banks, brokerages, market funds). */
export function isMostLiquidSnapshotAccount(account: Account): boolean {
  return account.category === "cash" || account.category === "investments";
}

function mostLiquidAccountBalanceSum(
  snapshot: Snapshot,
  accounts: Account[],
): number {
  return accountBalanceSum(snapshot, accounts, [], isMostLiquidSnapshotAccount);
}

export function snapshotMostLiquidNetWorth(
  snapshot: Snapshot,
  accounts: Account[],
): number {
  return mostLiquidAccountBalanceSum(snapshot, accounts);
}

export function retirementTotal(
  snapshot: Snapshot,
  accounts: Account[],
): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return Object.entries(snapshot.balances).reduce((sum, [id, raw]) => {
    const account = byId.get(id);
    if (!account || account.archived || account.category !== "retirement")
      return sum;
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

export function generateInsights(data: FinanceData, hide = false): Insight[] {
  const insights: Insight[] = [];
  const latest = latestSnapshot(data);
  if (!latest) return insights;

  const accounts = data.accounts.filter((a) => !a.archived);
  const totals = categoryTotals(latest, accounts);
  const policies = data.insurancePolicies;
  const loans = data.personalLoans;
  const netWorth = snapshotNetWorth(
    latest,
    accounts,
    policies,
    loans,
    data.vehicle,
    data.property,
  );
  const liquidNw = snapshotLiquidNetWorth(latest, accounts, policies, loans);
  const prev = previousSnapshot(data, latest);
  const prevNw = prev
    ? snapshotNetWorth(
        prev,
        accounts,
        policies,
        loans,
        data.vehicle,
        data.property,
      )
    : null;
  const { percent: momPct } = monthOverMonthChange(netWorth, prevNw);

  const retTotal = retirementTotal(latest, accounts);
  if (retTotal > 0 && netWorth > 0) {
    insights.push({
      id: "liquid-nw",
      severity: "info",
      title: "Liquid vs total net worth",
      body: `Liquid net worth is ${formatCurrency(liquidNw, false, hide)} (${hide ? AMOUNT_MASK : `${((liquidNw / netWorth) * 100).toFixed(0)}%`} of total). Excludes CPF & SRS, property equity, vehicle value, and HDB/mortgage loans; includes insurance surrender values and personal loans receivable.`,
    });
  }

  const insTotal = insuranceTotal(policies);
  if (insTotal <= 0) {
    insights.push({
      id: "add-insurance",
      severity: "info",
      title: "Track insurance cash values",
      body: "Add whole-life, ILP, or endowment policies on the Insurance tab to include surrender values in your net worth.",
    });
  }

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
        body: `Cash covers about ${hide ? AMOUNT_MASK : monthsCovered.toFixed(1)} months of expenses. Target ${emergencyMonths} months (${formatCurrency(monthlyExpenses * emergencyMonths, false, hide)}) before aggressive investing.`,
      });
    } else if (monthsCovered > emergencyMonths + 3) {
      insights.push({
        id: "cash-drag",
        severity: "info",
        title: "Excess cash",
        body: `You hold ~${hide ? AMOUNT_MASK : monthsCovered.toFixed(0)} months of expenses in cash. Consider moving surplus above ${emergencyMonths} months into investments or debt payoff.`,
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
        body: `About ${formatCurrency(savings, false, hide)}/month after expenses (${formatPercent((savings / monthlyIncome) * 100, false, hide)} of gross income). Projections on the dashboard assume you invest this surplus.`,
      });
    }
  }

  if (liabilities > 0 && liabilities > cashPositive * 0.5) {
    insights.push({
      id: "debt-load",
      severity: liabilities > cashPositive ? "action" : "watch",
      title: "Debt vs liquid cash",
      body: `Liabilities (${formatCurrency(liabilities, false, hide)}) ${liabilities > cashPositive ? "exceed" : "are a significant share of"} your liquid cash (${formatCurrency(cashPositive, false, hide)}). Prioritize high-interest debt before new risk assets.`,
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
      body: `CPF & SRS are ${hide ? AMOUNT_MASK : `${((cpfTotal / netWorth) * 100).toFixed(0)}%`} of net worth. Remember OA can fund housing while SA builds retirement — plan liquidity outside CPF for emergencies.`,
    });
  }

  if (growthPct < 50 && netWorth > 80_000) {
    insights.push({
      id: "growth-allocation",
      severity: "watch",
      title: "Growth allocation is light",
      body: `Only ${hide ? AMOUNT_MASK : `${growthPct.toFixed(0)}%`} of investable assets are in investments + CPF/SRS (excluding OA used for property). Consider SRS or taxable ETFs if your horizon is 10+ years.`,
    });
  }

  if (cashPct > 25 && investable > 40_000) {
    insights.push({
      id: "high-cash",
      severity: "info",
      title: "High cash weight",
      body: `${hide ? AMOUNT_MASK : `${cashPct.toFixed(0)}%`} of investable assets sit in cash. Fine for near-term goals; otherwise consider DCA into diversified ETFs (e.g. VWRA, ES3).`,
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
        body: `Rule-of-thumb for age ${age}: ~${stockTarget}% in growth assets. You're around ${hide ? AMOUNT_MASK : `${equityLike.toFixed(0)}%`} in investments + CPF/SRS (investable only). CPF SA/RSTU and SRS count toward long-term growth.`,
      });
    }
  }

  if (momPct !== null && momPct < -5) {
    insights.push({
      id: "drawdown",
      severity: "info",
      title: "Recent dip",
      body: `Net worth fell ${formatPercent(Math.abs(momPct), false, hide)} since last snapshot. Review whether this is market noise, spending, or a category worth rebalancing.`,
    });
  }

  if (momPct !== null && momPct > 8) {
    insights.push({
      id: "surge",
      severity: "info",
      title: "Strong month",
      body: `Net worth grew ${formatPercent(momPct, false, hide)} month-over-month. Good time to confirm allocation still matches goals rather than letting drift run.`,
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
          body: `Target ${target}% vs actual ${hide ? AMOUNT_MASK : `${actual.toFixed(0)}%`}. Rebalance or update targets in Settings if your plan changed.`,
        });
      }
    }
  }

  return insights;
}
