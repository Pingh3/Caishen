import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatCurrency,
  insuranceTotal,
  isLiquidSnapshotAccount,
  isMostLiquidSnapshotAccount,
  isPropertyLinkedLiability,
  personalLoansTotal,
  signedBalance,
  snapshotLiquidNetWorth,
  snapshotMostLiquidNetWorth,
  snapshotNetWorth,
  vehicleValue,
  carLoanOwed,
  propertyGrossValue,
  propertyNetEquity,
  mortgageOwed,
} from "./finance";
import type {
  Account,
  AccountCategory,
  FinanceData,
  InsurancePolicy,
  PersonalLoan,
  PropertyProfile,
  Snapshot,
  VehicleProfile,
} from "./types";

export type BreakdownLine = {
  label: string;
  amount?: number;
  href?: string;
  /** Section header or note (no amount column) */
  note?: boolean;
  muted?: boolean;
};

export type StatBreakdown = {
  id: string;
  title: string;
  lines: BreakdownLine[];
  totalLabel: string;
  total: number;
  footnote?: string;
};

function accountLines(
  snapshot: Snapshot,
  accounts: Account[],
  filter?: (account: Account) => boolean,
): BreakdownLine[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const lines: BreakdownLine[] = [];

  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = byId.get(id);
    if (!account || account.archived) continue;
    if (filter && !filter(account)) continue;
    const amount = signedBalance(account, raw);
    if (amount === 0) continue;
    lines.push({
      label: account.name,
      amount,
      muted: filter ? false : undefined,
    });
  }

  lines.sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0));
  return lines;
}

function propertyBreakdownLines(
  snapshot: Snapshot,
  accounts: Account[],
  profile?: PropertyProfile,
): BreakdownLine[] {
  const gross = propertyGrossValue(snapshot, accounts, profile);
  const mort = mortgageOwed(snapshot, accounts, profile);
  const net = propertyNetEquity(snapshot, accounts, profile);
  if (gross <= 0 && net <= 0) return [];

  const lines: BreakdownLine[] = [];
  if (gross > 0) {
    lines.push({
      label: "Property (estimated value)",
      amount: gross,
      href: "/property",
    });
  }
  if (mort > 0) {
    lines.push({
      label: "Less mortgage / HDB loan",
      amount: -mort,
      href: "/update",
    });
  }
  if (lines.length > 1) {
    lines.push({
      label: "Property (net equity)",
      amount: net,
      href: "/property",
    });
  } else if (net > 0) {
    lines[0] = {
      label: "Property (net equity)",
      amount: net,
      href: "/property",
    };
  }
  return lines;
}

function categorySubtotals(
  snapshot: Snapshot,
  accounts: Account[],
  categories: AccountCategory[],
): BreakdownLine[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const sums: Partial<Record<AccountCategory, number>> = {};

  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = byId.get(id);
    if (!account || account.archived) continue;
    if (!categories.includes(account.category)) continue;
    sums[account.category] = (sums[account.category] ?? 0) + signedBalance(account, raw);
  }

  return CATEGORY_ORDER.filter((c) => categories.includes(c))
    .map((cat) => ({
      label: CATEGORY_LABELS[cat],
      amount: sums[cat] ?? 0,
    }))
    .filter((l) => l.amount !== 0);
}

export function buildNetWorthBreakdown(
  snapshot: Snapshot,
  accounts: Account[],
  policies: InsurancePolicy[] | undefined,
  loans: PersonalLoan[] | undefined,
  vehicle?: VehicleProfile,
  property?: PropertyProfile,
): StatBreakdown {
  const liabilityLines = accountLines(
    snapshot,
    accounts,
    (a) => a.category === "liability" && !isPropertyLinkedLiability(a),
  );
  const lines: BreakdownLine[] = [
    ...categorySubtotals(snapshot, accounts, [
      "cash",
      "investments",
      "retirement",
      "other_asset",
    ]),
    ...propertyBreakdownLines(snapshot, accounts, property),
    ...liabilityLines,
  ];

  const ins = insuranceTotal(policies);
  if (ins > 0) {
    lines.push({
      label: "Insurance (surrender)",
      amount: ins,
      href: "/insurance",
    });
  }

  const loanRecv = personalLoansTotal(loans);
  if (loanRecv > 0) {
    lines.push({
      label: "Loans to others",
      amount: loanRecv,
      href: "/loans",
    });
  }

  const carVal = vehicleValue(vehicle);
  if (carVal > 0) {
    lines.push({
      label: vehicle?.makeModel
        ? `Vehicle (${vehicle.makeModel})`
        : "Vehicle",
      amount: carVal,
      href: "/vehicle",
    });
  }

  return {
    id: "net-worth",
    title: "Net worth breakdown",
    lines,
    totalLabel: "Total net worth",
    total: snapshotNetWorth(
      snapshot,
      accounts,
      policies,
      loans,
      vehicle,
      property,
    ),
    footnote: `Snapshot ${snapshot.date}. Property is market value minus mortgage.`,
  };
}

export function buildLiquidNetWorthBreakdown(
  snapshot: Snapshot,
  accounts: Account[],
  policies: InsurancePolicy[] | undefined,
  loans: PersonalLoan[] | undefined,
  vehicle?: VehicleProfile,
): StatBreakdown {
  const lines: BreakdownLine[] = [
    ...accountLines(snapshot, accounts, isLiquidSnapshotAccount),
  ];

  const ins = insuranceTotal(policies);
  if (ins > 0) {
    lines.push({
      label: "Insurance (surrender)",
      amount: ins,
      href: "/insurance",
    });
  }

  const loanRecv = personalLoansTotal(loans);
  if (loanRecv > 0) {
    lines.push({
      label: "Loans to others",
      amount: loanRecv,
      href: "/loans",
    });
  }

  const excluded = accountLines(
    snapshot,
    accounts,
    (a) => !isLiquidSnapshotAccount(a),
  );
  const carVal = vehicleValue(vehicle);
  if (carVal > 0) {
    excluded.push({
      label: vehicle?.makeModel
        ? `Vehicle (${vehicle.makeModel})`
        : "Vehicle",
      amount: carVal,
      href: "/vehicle",
    });
  }
  if (excluded.length > 0) {
    lines.push({ label: "Excluded (illiquid / property)", note: true, muted: true });
    lines.push(...excluded.map((l) => ({ ...l, muted: true })));
  }

  return {
    id: "liquid-net-worth",
    title: "Liquid net worth breakdown",
    lines,
    totalLabel: "Liquid net worth",
    total: snapshotLiquidNetWorth(snapshot, accounts, policies, loans),
    footnote:
      "Excludes CPF & SRS, property equity, vehicle value, and HDB/mortgage loans.",
  };
}

export function buildMostLiquidNetWorthBreakdown(
  snapshot: Snapshot,
  accounts: Account[],
  policies: InsurancePolicy[] | undefined,
  loans: PersonalLoan[] | undefined,
  vehicle?: VehicleProfile,
): StatBreakdown {
  const lines: BreakdownLine[] = [
    ...accountLines(snapshot, accounts, isMostLiquidSnapshotAccount),
  ];

  const omitted: BreakdownLine[] = [];
  const ins = insuranceTotal(policies);
  if (ins > 0) {
    omitted.push({ label: "Insurance (surrender)", amount: ins, muted: true });
  }
  const loanRecv = personalLoansTotal(loans);
  if (loanRecv > 0) {
    omitted.push({ label: "Loans to others", amount: loanRecv, muted: true });
  }
  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = accounts.find((a) => a.id === id && !a.archived);
    if (!account || account.category !== "liability") continue;
    if (!/car/i.test(account.name)) continue;
    const amount = Math.abs(signedBalance(account, raw));
    if (amount > 0) {
      omitted.push({ label: account.name, amount, muted: true });
    }
  }
  const carVal = vehicleValue(vehicle);
  if (carVal > 0) {
    omitted.push({
      label: vehicle?.makeModel
        ? `Vehicle (${vehicle.makeModel})`
        : "Vehicle",
      amount: carVal,
      muted: true,
    });
  }

  if (omitted.length > 0) {
    lines.push({ label: "Not included in this total", note: true, muted: true });
    lines.push(...omitted);
  }

  return {
    id: "most-liquid-net-worth",
    title: "Most liquid net worth",
    lines,
    totalLabel: "Most liquid net worth",
    total: snapshotMostLiquidNetWorth(snapshot, accounts),
    footnote:
      "Sum of cash and investment accounts only (e.g. DBS, UOB, Moomoo, Syfe, Market Funds).",
  };
}

export function buildMomBreakdown(
  latest: Snapshot,
  prev: Snapshot | null,
  accounts: Account[],
  policies: InsurancePolicy[] | undefined,
  loans: PersonalLoan[] | undefined,
  vehicle?: VehicleProfile,
  property?: PropertyProfile,
): StatBreakdown {
  const current = snapshotNetWorth(
    latest,
    accounts,
    policies,
    loans,
    vehicle,
    property,
  );
  const previous = prev
    ? snapshotNetWorth(prev, accounts, policies, loans, vehicle, property)
    : null;

  const lines: BreakdownLine[] =
    previous === null
      ? [{ label: "No earlier snapshot to compare", note: true }]
      : [
          { label: `Previous (${prev!.date})`, amount: previous },
          { label: `Current (${latest.date})`, amount: current },
          {
            label: "Change",
            amount: current - previous,
          },
        ];

  return {
    id: "mom",
    title: "Month over month",
    lines,
    totalLabel: "Net change",
    total: previous !== null ? current - previous : 0,
  };
}

export function buildInsuranceBreakdown(
  policies: InsurancePolicy[] | undefined,
): StatBreakdown {
  const active = (policies ?? []).filter((p) => !p.archived);
  const lines: BreakdownLine[] = active.map((p) => ({
    label: `${p.insurer} — ${p.planName}`,
    amount: p.surrenderValue,
    href: "/insurance",
  }));

  if (lines.length === 0) {
    lines.push({ label: "No policies tracked", note: true });
  }

  return {
    id: "insurance",
    title: "Insurance surrender values",
    lines,
    totalLabel: "Total surrender value",
    total: insuranceTotal(policies),
    footnote: "Included in net worth and liquid net worth.",
  };
}

export function buildPersonalLoansBreakdown(
  loans: PersonalLoan[] | undefined,
): StatBreakdown {
  const active = (loans ?? []).filter((l) => !l.archived);
  const lines: BreakdownLine[] = active.map((l) => ({
    label: l.borrowerName,
    amount: l.principalOutstanding,
    href: "/loans",
  }));

  if (lines.length === 0) {
    lines.push({ label: "No loans tracked", note: true });
  }

  return {
    id: "loans",
    title: "Loans to others",
    lines,
    totalLabel: "Total receivable",
    total: personalLoansTotal(loans),
    footnote: "Included in net worth and liquid net worth.",
  };
}

export function buildInvestableBreakdown(
  snapshot: Snapshot,
  accounts: Account[],
  policies: InsurancePolicy[] | undefined,
): StatBreakdown {
  const cats: AccountCategory[] = [
    "cash",
    "investments",
    "retirement",
    "other_asset",
  ];
  const lines = categorySubtotals(snapshot, accounts, cats);
  const ins = insuranceTotal(policies);
  if (ins > 0) {
    lines.push({
      label: "Insurance (surrender)",
      amount: ins,
      href: "/insurance",
    });
  }

  const total =
    lines.reduce((s, l) => s + (l.amount ?? 0), 0);

  return {
    id: "investable",
    title: "Investable assets",
    lines,
    totalLabel: "Total investable",
    total,
    footnote: "Cash + investments + CPF/SRS + other assets + insurance.",
  };
}

export function buildVehicleBreakdown(
  vehicle: VehicleProfile | undefined,
  snapshot: Snapshot,
  accounts: Account[],
): StatBreakdown {
  const val = vehicleValue(vehicle);
  const loan = carLoanOwed(snapshot, accounts);
  const lines: BreakdownLine[] = [];

  if (val > 0) {
    lines.push({
      label: vehicle?.makeModel ?? "Estimated value",
      amount: val,
      href: "/vehicle",
    });
  }
  if (loan > 0) {
    lines.push({
      label: "Car loan (Update tab)",
      amount: -loan,
      href: "/update",
    });
  }
  if (lines.length === 0) {
    lines.push({ label: "No vehicle tracked", note: true });
  }

  return {
    id: "vehicle",
    title: "Vehicle",
    lines,
    totalLabel: "Net vehicle equity",
    total: val - loan,
    footnote: "Vehicle value is in total net worth; car loan is a liability account.",
  };
}

export function buildLiabilitiesBreakdown(
  snapshot: Snapshot,
  accounts: Account[],
): StatBreakdown {
  const lines: BreakdownLine[] = accountLines(
    snapshot,
    accounts,
    (a) => a.category === "liability",
  ).map((l) => ({
    ...l,
    amount: l.amount !== undefined ? Math.abs(l.amount) : undefined,
  }));

  if (lines.length === 0) {
    lines.push({ label: "No liabilities in snapshot", note: true });
  }

  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);

  return {
    id: "liabilities",
    title: "Liabilities",
    lines,
    totalLabel: "Total owed",
    total,
    footnote: "Reduces net worth.",
  };
}

export function buildAllDashboardBreakdowns(
  data: FinanceData,
  latest: Snapshot,
  prev: Snapshot | null,
  accounts: Account[],
): StatBreakdown[] {
  const policies = data.insurancePolicies;
  const loans = data.personalLoans;
  const vehicle = data.vehicle;
  const property = data.property;
  return [
    buildNetWorthBreakdown(latest, accounts, policies, loans, vehicle, property),
    buildLiquidNetWorthBreakdown(latest, accounts, policies, loans, vehicle),
    buildMostLiquidNetWorthBreakdown(latest, accounts, policies, loans, vehicle),
    buildMomBreakdown(latest, prev, accounts, policies, loans, vehicle, property),
    buildInsuranceBreakdown(policies),
    buildPersonalLoansBreakdown(loans),
    buildVehicleBreakdown(vehicle, latest, accounts),
    buildInvestableBreakdown(latest, accounts, policies),
    buildLiabilitiesBreakdown(latest, accounts),
  ];
}

export function formatBreakdownAmount(amount: number): string {
  const prefix = amount < 0 ? "−" : "";
  return `${prefix}${formatCurrency(Math.abs(amount))}`;
}
