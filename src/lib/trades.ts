import { formatCurrency, formatPercent } from "./finance";
import type { Holding, QuoteResult, StockMarket, Trade, TradeCategory } from "./types";
import type { FxRates } from "./market";
import { fxForMarket } from "./market";

export const TRADE_CATEGORY_LABELS: Record<TradeCategory, string> = {
  stocks: "Stocks",
  govt: "Govt securities",
  robo: "Robo / funds",
  other: "Other",
};

export function isTradeOpen(trade: Trade): boolean {
  return !trade.exitDate;
}

/** Native currency → SGD multiplier. */
export function tradeFxToSgd(trade: Trade, fx: FxRates): number {
  return fxForMarket(trade.market, fx);
}

export function tradeDaysHeld(trade: Trade, asOf = new Date()): number {
  const start = new Date(trade.entryDate);
  const end = trade.exitDate ? new Date(trade.exitDate) : asOf;
  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

export function tradeCostNative(trade: Trade): number {
  return trade.quantity * trade.entryPrice;
}

export function tradeTotalCommission(trade: Trade): number {
  const entry = trade.entryCommission ?? trade.fees ?? 0;
  return entry + (trade.exitCommission ?? 0);
}

export function tradePnlNative(
  trade: Trade,
  markPrice?: number,
): { pnl: number; pnlPct: number | null; cost: number } | null {
  const cost = tradeCostNative(trade);
  if (cost <= 0) return null;
  const price = trade.exitPrice ?? markPrice;
  if (price === undefined) return null;
  const proceeds =
    trade.quantity * price + (trade.dividendIncome ?? 0);
  const pnl = proceeds - cost - tradeTotalCommission(trade);
  return { pnl, pnlPct: (pnl / cost) * 100, cost };
}

export function tradePnlSgd(
  trade: Trade,
  markPrice: number | undefined,
  fx: FxRates,
): { pnlSgd: number; pnlPct: number | null } | null {
  const raw = tradePnlNative(trade, markPrice);
  if (!raw) return null;
  const rate = tradeFxToSgd(trade, fx);
  return {
    pnlSgd: raw.pnl * rate,
    pnlPct: raw.pnlPct,
  };
}

export type JournalStats = {
  openCount: number;
  closedCount: number;
  openCostSgd: number;
  openUnrealizedSgd: number;
  realizedPnlSgd: number;
  winRate: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
};

export function computeJournalStats(
  trades: Trade[],
  quotes: Map<string, QuoteResult>,
  fx: FxRates,
): JournalStats {
  let openCount = 0;
  let closedCount = 0;
  let openCostSgd = 0;
  let openUnrealizedSgd = 0;
  let realizedPnlSgd = 0;
  const closedReturns: { won: boolean; pct: number }[] = [];

  for (const t of trades) {
    const rate = tradeFxToSgd(t, fx);
    const costSgd = tradeCostNative(t) * rate;

    if (isTradeOpen(t)) {
      openCount++;
      openCostSgd += costSgd;
      const q =
        t.category === "stocks"
          ? quotes.get(`${t.market}:${t.symbol.toUpperCase()}`)
          : undefined;
      const mark = t.exitPrice ?? q?.price;
      const pnl = tradePnlSgd(t, mark, fx);
      if (pnl) openUnrealizedSgd += pnl.pnlSgd;
    } else {
      closedCount++;
      const pnl = tradePnlSgd(t, t.exitPrice, fx);
      if (pnl) {
        realizedPnlSgd += pnl.pnlSgd;
        if (pnl.pnlPct !== null) {
          closedReturns.push({ won: pnl.pnlSgd > 0, pct: pnl.pnlPct });
        }
      }
    }
  }

  const wins = closedReturns.filter((r) => r.won);
  const losses = closedReturns.filter((r) => !r.won);

  return {
    openCount,
    closedCount,
    openCostSgd,
    openUnrealizedSgd,
    realizedPnlSgd,
    winRate:
      closedReturns.length > 0
        ? (wins.length / closedReturns.length) * 100
        : null,
    avgWinPct:
      wins.length > 0
        ? wins.reduce((s, w) => s + w.pct, 0) / wins.length
        : null,
    avgLossPct:
      losses.length > 0
        ? losses.reduce((s, w) => s + w.pct, 0) / losses.length
        : null,
  };
}

/** Merge open stock trades into holdings for the Investments tab. */
export function holdingsFromOpenTrades(trades: Trade[]): Holding[] {
  const open = trades.filter((t) => isTradeOpen(t) && t.category === "stocks");
  const buckets = new Map<
    string,
    { market: StockMarket; symbol: string; qty: number; cost: number; accountId?: string }
  >();

  for (const t of open) {
    const key = `${t.market}:${t.symbol.toUpperCase()}`;
    const prev = buckets.get(key);
    const cost = t.quantity * t.entryPrice;
    if (!prev) {
      buckets.set(key, {
        market: t.market,
        symbol: t.symbol.toUpperCase(),
        qty: t.quantity,
        cost,
        accountId: t.linkedAccountId,
      });
    } else {
      const totalQty = prev.qty + t.quantity;
      buckets.set(key, {
        ...prev,
        qty: totalQty,
        cost: prev.cost + cost,
        accountId: t.linkedAccountId ?? prev.accountId,
      });
    }
  }

  return [...buckets.values()].map((b) => ({
    id: `from-trade-${b.market}-${b.symbol}`,
    symbol: b.symbol,
    market: b.market,
    quantity: b.qty,
    avgEntryPrice: b.cost / b.qty,
    linkedAccountId: b.accountId,
  }));
}

export function formatTradePnlLine(
  pnlSgd: number,
  pnlPct: number | null,
): string {
  const pct =
    pnlPct !== null ? ` (${formatPercent(pnlPct, true)})` : "";
  return `${formatCurrency(pnlSgd)}${pct}`;
}
