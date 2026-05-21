import type { StockMarket, Trade } from "./types";
import { normalizeSymbol } from "./market";

/** Default US dividend withholding for non-US tax residents (e.g. via broker). */
export const US_DIVIDEND_WHT_RATE = 0.3;

/** Convert gross dividend (Yahoo) to net amount stored on trades. SG/other: unchanged. */
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

export async function fetchDividendsForTrade(
  trade: Trade,
): Promise<{ totalNative: number; payments: number } | null> {
  if (trade.category !== "stocks") return null;

  const ySym = yahooSymbol(trade.symbol, trade.market);
  const start = Math.floor(new Date(trade.entryDate).getTime() / 1000);
  const end = trade.exitDate
    ? Math.floor(new Date(trade.exitDate).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

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
    let perShareTotal = 0;
    let payments = 0;

    for (const ev of Object.values(events)) {
      if (ev.date >= start && ev.date <= end) {
        perShareTotal += ev.amount;
        payments += 1;
      }
    }

    return {
      totalNative: perShareTotal * trade.quantity,
      payments,
    };
  } catch {
    return null;
  }
}

export async function applyDividendsToTrades(
  trades: Trade[],
): Promise<{ trades: Trade[]; updated: number }> {
  const next = [...trades];
  let updated = 0;

  for (let i = 0; i < next.length; i++) {
    const t = next[i];
    if (t.category !== "stocks") continue;

    const result = await fetchDividendsForTrade(t);
    if (result === null) continue;

    next[i] = {
      ...t,
      dividendIncome: netDividendFromGross(t.market, result.totalNative),
      dividendsAutoUpdated: new Date().toISOString().slice(0, 10),
    };
    updated += 1;
  }

  return { trades: next, updated };
}
