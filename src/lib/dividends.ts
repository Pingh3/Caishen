import type { StockMarket, Trade } from "./types";
import { normalizeSymbol } from "./market";

/** Default US dividend withholding for non-US tax residents (e.g. via broker). */
export const US_DIVIDEND_WHT_RATE = 0.3;

/** Convert gross dividend total to net (US: ×70%). */
export function netDividendFromGross(
  market: StockMarket,
  grossNative: number,
): number {
  const net =
    market === "US"
      ? grossNative * (1 - US_DIVIDEND_WHT_RATE)
      : grossNative;
  return Math.round(net * 100) / 100;
}

export function tradeDividendPerShare(
  trade: Trade,
  which: "net" | "gross" = "net",
): number | null {
  if (trade.quantity <= 0) return null;
  const total =
    which === "gross"
      ? trade.dividendGross ?? (trade.market === "US" ? undefined : trade.dividendIncome)
      : trade.dividendIncome;
  if (total === undefined) return null;
  return Math.round((total / trade.quantity) * 10000) / 10000;
}

export type DividendFetchResult = {
  perShareGross: number;
  grossTotal: number;
  payments: number;
};

type YahooDivEvent = {
  chart?: {
    result?: {
      events?: {
        dividends?: Record<string, { amount: number; date: number }>;
      };
    }[];
  };
};

function yahooSymbol(symbol: string, market: StockMarket): string {
  const base = normalizeSymbol(symbol);
  if (market === "SG") return `${base}.SI`;
  if (market === "HK") return `${base}.HK`;
  return base;
}

function tradeDateRange(trade: Trade): { start: number; end: number } {
  const start = Math.floor(
    new Date(`${trade.entryDate}T00:00:00`).getTime() / 1000,
  );
  const end = trade.exitDate
    ? Math.floor(new Date(`${trade.exitDate}T23:59:59`).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  return { start, end };
}

export async function fetchDividendsForTrade(
  trade: Trade,
): Promise<DividendFetchResult | null> {
  if (trade.category !== "stocks") return null;

  const ySym = yahooSymbol(trade.symbol, trade.market);
  const { start, end } = tradeDateRange(trade);

  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(ySym) +
      "?interval=1d&range=max&events=div";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as YahooDivEvent;
    const events = json.chart?.result?.[0]?.events?.dividends ?? {};
    let perShareGross = 0;
    let payments = 0;

    for (const ev of Object.values(events)) {
      if (ev.date >= start && ev.date <= end) {
        perShareGross += ev.amount;
        payments += 1;
      }
    }

    return {
      perShareGross,
      grossTotal: perShareGross * trade.quantity,
      payments,
    };
  } catch {
    return null;
  }
}

export type DividendApplyResult = {
  trades: Trade[];
  updated: number;
  /** US trades where gross Yahoo total was reduced by 30% WHT */
  usNetApplied: number;
};

export async function applyDividendsToTrades(
  trades: Trade[],
): Promise<DividendApplyResult> {
  const next = [...trades];
  let updated = 0;
  let usNetApplied = 0;
  const today = new Date().toISOString().slice(0, 10);

  const stockIndexes = next
    .map((t, i) => (t.category === "stocks" ? i : -1))
    .filter((i) => i >= 0);

  await Promise.all(
    stockIndexes.map(async (i) => {
      const t = next[i];
      const result = await fetchDividendsForTrade(t);
      if (result === null || result.payments === 0) return;

      const grossTotal = Math.round(result.grossTotal * 100) / 100;
      const netTotal = netDividendFromGross(t.market, grossTotal);

      next[i] = {
        ...t,
        dividendGross: t.market === "US" ? grossTotal : undefined,
        dividendIncome: netTotal,
        dividendsAutoUpdated: today,
      };
      updated += 1;
      if (t.market === "US") usNetApplied += 1;
    }),
  );

  return { trades: next, updated, usNetApplied };
}
