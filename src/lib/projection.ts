import {
  latestSnapshot,
  snapshotNetWorth,
} from "./finance";
import type { Account, FinanceData } from "./types";

export type ProjectionRow = {
  years: number;
  label: string;
  netWorth: number;
};

export function effectiveMonthlyIncome(
  settings: FinanceData["settings"],
): number | null {
  const monthly = settings?.monthlyIncome;
  if (monthly === undefined || monthly <= 0) return null;
  const bonus = settings?.annualBonus ?? 0;
  return monthly + bonus / 12;
}

export function monthlySavings(data: FinanceData): number | null {
  const income = effectiveMonthlyIncome(data.settings);
  if (income === null) return null;
  const latest = latestSnapshot(data);
  const expenses = latest?.monthlyExpenses ?? 0;
  return income - expenses;
}

/** Compound monthly: start balance, add contribution each month, annual return %. */
export function projectNetWorth(
  startNetWorth: number,
  monthlyContribution: number,
  years: number,
  annualReturnPct = 5,
): number {
  const months = years * 12;
  const r = annualReturnPct / 100 / 12;
  let balance = startNetWorth;
  for (let m = 0; m < months; m++) {
    balance = balance * (1 + r) + monthlyContribution;
  }
  return Math.round(balance);
}

export function buildProjections(
  data: FinanceData,
  accounts: Account[],
): { monthlySavings: number; monthlyIncome: number; rows: ProjectionRow[] } | null {
  const savings = monthlySavings(data);
  const monthlyIncome = effectiveMonthlyIncome(data.settings);
  if (savings === null || monthlyIncome === null) return null;

  const latest = latestSnapshot(data);
  if (!latest) return null;

  const start = snapshotNetWorth(latest, accounts);
  const returnPct = data.settings?.projectionReturnPct ?? 5;
  const horizons = [1, 3, 5, 10, 20];

  return {
    monthlySavings: savings,
    monthlyIncome,
    rows: horizons.map((y) => ({
      years: y,
      label: y === 1 ? "1 year" : `${y} years`,
      netWorth: projectNetWorth(start, savings, y, returnPct),
    })),
  };
}
