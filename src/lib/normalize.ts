import type { FinanceData, Trade } from "./types";

function normalizeTrade(t: Trade): Trade {
  return {
    ...t,
    entryCommission:
      t.entryCommission ?? (t.fees !== undefined ? t.fees : undefined),
  };
}

export function normalizeFinanceData(raw: FinanceData): FinanceData {
  return {
    ...raw,
    accounts: raw.accounts ?? [],
    snapshots: raw.snapshots ?? [],
    holdings: raw.holdings ?? [],
    trades: (raw.trades ?? []).map(normalizeTrade),
    insurancePolicies: raw.insurancePolicies ?? [],
    settings: raw.settings ?? {
      emergencyFundMonths: 6,
      timezone: "Asia/Singapore",
    },
  };
}
