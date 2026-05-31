import { ensureCoreAccounts } from "./finance";
import { normalizeTradeDividends } from "./dividends";
import type { FinanceData, Trade } from "./types";

function normalizeTrade(t: Trade): Trade {
  const quantity = Number(t.quantity);
  const entryPrice = Number(t.entryPrice);
  const base: Trade = {
    ...t,
    quantity: Number.isFinite(quantity) ? quantity : t.quantity,
    entryPrice: Number.isFinite(entryPrice) ? entryPrice : t.entryPrice,
    entryCommission:
      t.entryCommission ?? (t.fees !== undefined ? t.fees : undefined),
  };
  return normalizeTradeDividends(base);
}
export function normalizeFinanceData(raw: FinanceData): FinanceData {
  const base: FinanceData = {
    ...raw,
    accounts: raw.accounts ?? [],
    snapshots: raw.snapshots ?? [],
    holdings: raw.holdings ?? [],
    trades: (raw.trades ?? []).map(normalizeTrade),
    insurancePolicies: raw.insurancePolicies ?? [],
    personalLoans: raw.personalLoans ?? [],
    settings: raw.settings ?? {
      emergencyFundMonths: 6,
      timezone: "Asia/Singapore",
    },
  };
  return ensureCoreAccounts(base);
}
