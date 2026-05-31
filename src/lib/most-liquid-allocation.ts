import { isMostLiquidSnapshotAccount, signedBalance } from "./finance";
import {
  holdingCostSgd,
  holdingValueSgd,
  type FxRates,
} from "./market";
import { holdingsFromOpenTrades } from "./trades";
import type {
  Account,
  FinanceData,
  Holding,
  MostLiquidPlan,
  QuoteResult,
  Snapshot,
} from "./types";

export type MostLiquidBucketId =
  | "cash"
  | "sg_stocks"
  | "us_hk_stocks"
  | "funds_other";

export const MOST_LIQUID_BUCKET_LABELS: Record<MostLiquidBucketId, string> = {
  cash: "Cash",
  sg_stocks: "SG stocks",
  us_hk_stocks: "US / HK stocks",
  funds_other: "Funds & other",
};

export const MOST_LIQUID_BUCKET_COLORS: Record<MostLiquidBucketId, string> = {
  cash: "#34d399",
  sg_stocks: "#3d9cf0",
  us_hk_stocks: "#a78bfa",
  funds_other: "#fbbf24",
};

export const DEFAULT_MAX_STOCKS_FUNDS_PCT = 70;
export const DEFAULT_SG_SHARE_OF_STOCKS_FUNDS_PCT = 50;

export type MostLiquidAllocationSlice = {
  id: MostLiquidBucketId;
  name: string;
  value: number;
  pct: number;
};

export type MostLiquidAllocationResult = {
  total: number;
  slices: MostLiquidAllocationSlice[];
  stocksFundsTotal: number;
  stocksFundsPct: number;
  cashPct: number;
  sgStocksPctOfTotal: number;
  sgShareOfStocksFundsPct: number | null;
  targets: {
    maxStocksFundsPct: number;
    sgShareOfStocksFundsPct: number;
    sgStocksPctOfTotalAtPlan: number;
  };
};

export function mergePortfolioHoldings(data: FinanceData): Holding[] {
  const manual = data.holdings ?? [];
  const derived = holdingsFromOpenTrades(data.trades ?? []);
  const byKey = new Map<string, Holding>();
  for (const h of derived) {
    byKey.set(`${h.market}:${h.symbol.toUpperCase()}`, h);
  }
  for (const h of manual) {
    byKey.set(`${h.market}:${h.symbol.toUpperCase()}`, h);
  }
  return [...byKey.values()];
}

function holdingValueSgdOrCost(
  holding: Holding,
  quoteMap: Map<string, QuoteResult>,
  fx: FxRates,
): number {
  const q = quoteMap.get(`${holding.market}:${holding.symbol.toUpperCase()}`);
  const live = holdingValueSgd(holding, q);
  if (live > 0) return live;
  return holdingCostSgd(holding, fx);
}

export function buildMostLiquidAllocation(
  snapshot: Snapshot,
  accounts: Account[],
  holdings: Holding[],
  quotes: QuoteResult[],
  fx: FxRates,
  plan?: MostLiquidPlan,
): MostLiquidAllocationResult {
  const maxStocksFundsPct = plan?.maxStocksFundsPct ?? DEFAULT_MAX_STOCKS_FUNDS_PCT;
  const sgShareOfStocksFundsPct =
    plan?.sgShareOfStocksFundsPct ?? DEFAULT_SG_SHARE_OF_STOCKS_FUNDS_PCT;

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const quoteMap = new Map(
    quotes.map((q) => [`${q.market}:${q.symbol.toUpperCase()}`, q]),
  );

  let cash = 0;
  let investmentTotal = 0;
  const investmentAccountIds = new Set<string>();

  for (const [id, raw] of Object.entries(snapshot.balances)) {
    const account = byId.get(id);
    if (!account || account.archived || !isMostLiquidSnapshotAccount(account)) {
      continue;
    }
    const amount = signedBalance(account, raw);
    if (account.category === "cash") {
      cash += amount;
    } else if (account.category === "investments") {
      investmentAccountIds.add(id);
      investmentTotal += Math.max(0, amount);
    }
  }

  const holdingsByAccount = new Map<string, { sg: number; usHk: number }>();
  let unlinkedSg = 0;
  let unlinkedUsHk = 0;

  for (const h of holdings) {
    const val = holdingValueSgdOrCost(h, quoteMap, fx);
    if (val <= 0) continue;

    if (h.linkedAccountId && investmentAccountIds.has(h.linkedAccountId)) {
      const entry = holdingsByAccount.get(h.linkedAccountId) ?? { sg: 0, usHk: 0 };
      if (h.market === "SG") entry.sg += val;
      else entry.usHk += val;
      holdingsByAccount.set(h.linkedAccountId, entry);
    } else {
      if (h.market === "SG") unlinkedSg += val;
      else unlinkedUsHk += val;
    }
  }

  let sg = 0;
  let usHk = 0;
  let funds = 0;

  for (const acctId of investmentAccountIds) {
    const balance = Math.max(0, snapshot.balances[acctId] ?? 0);
    const split = holdingsByAccount.get(acctId) ?? { sg: 0, usHk: 0 };
    const stockVal = split.sg + split.usHk;

    if (stockVal > 0 && stockVal <= balance) {
      sg += split.sg;
      usHk += split.usHk;
      funds += balance - stockVal;
    } else if (stockVal > balance && balance > 0) {
      const scale = balance / stockVal;
      sg += split.sg * scale;
      usHk += split.usHk * scale;
    } else {
      funds += balance;
    }
  }

  sg += unlinkedSg;
  usHk += unlinkedUsHk;

  const stockTotal = sg + usHk;
  const investedComputed = stockTotal + funds;
  if (investedComputed > investmentTotal + 1 && investmentTotal > 0) {
    const scale = investmentTotal / investedComputed;
    sg *= scale;
    usHk *= scale;
    funds *= scale;
  } else if (investedComputed < investmentTotal) {
    funds += investmentTotal - investedComputed;
  }

  const total = cash + sg + usHk + funds;
  const stocksFundsTotal = sg + usHk + funds;

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  const slices: MostLiquidAllocationSlice[] = (
    [
      ["cash", cash],
      ["sg_stocks", sg],
      ["us_hk_stocks", usHk],
      ["funds_other", funds],
    ] as const
  )
    .filter(([, v]) => v > 0)
    .map(([id, value]) => ({
      id,
      name: MOST_LIQUID_BUCKET_LABELS[id],
      value,
      pct: pct(value),
    }));

  return {
    total,
    slices,
    stocksFundsTotal,
    stocksFundsPct: pct(stocksFundsTotal),
    cashPct: pct(cash),
    sgStocksPctOfTotal: pct(sg),
    sgShareOfStocksFundsPct:
      stocksFundsTotal > 0 ? (sg / stocksFundsTotal) * 100 : null,
    targets: {
      maxStocksFundsPct,
      sgShareOfStocksFundsPct,
      sgStocksPctOfTotalAtPlan:
        (maxStocksFundsPct * sgShareOfStocksFundsPct) / 100,
    },
  };
}
