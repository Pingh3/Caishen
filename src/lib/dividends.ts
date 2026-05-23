import type { StockMarket, Trade } from "./types";
import { normalizeSymbol } from "./market";

export const US_DIVIDEND_WHT_RATE = 0.3;

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
      ? trade.dividendGross ??
        (trade.market === "US" ? undefined : trade.dividendIncome)
      : trade.dividendIncome;
  if (total === undefined) return null;
  return Math.round((total / trade.quantity) * 10000) / 10000;
}

export type DividendPaymentRecord = {
  date: string;
  amountPerShare: number;
};

export type DividendFetchResult = {
  perShareGross: number;
  grossTotal: number;
  payments: DividendPaymentRecord[];
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

export function tradeDateUnix(
  dateStr: string,
  bound: "start" | "end",
): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (bound === "start") {
    return Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
  }
  return Math.floor(Date.UTC(y, m - 1, d, 23, 59, 59) / 1000);
}

function exDateIso(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

export function isExDateInHoldingPeriod(
  exUnix: number,
  entryDate: string,
  exitDate?: string,
): boolean {
  const entryStart = tradeDateUnix(entryDate, "start");
  const exitEnd = exitDate
    ? tradeDateUnix(exitDate, "end")
    : Math.floor(Date.now() / 1000);
  return exUnix >= entryStart && exUnix <= exitEnd;
}

export function holdingPeriodLabel(trade: Trade): string {
  return `${trade.entryDate} -> ${trade.exitDate ?? "today"}`;
}

export async function fetchDividendsForTrade(
  trade: Trade,
): Promise<DividendFetchResult | null> {
  if (trade.category !== "stocks") return null;

  const ySym = yahooSymbol(trade.symbol, trade.market);

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
    const payments: DividendPaymentRecord[] = [];

    for (const ev of Object.values(events)) {
      if (
        !isExDateInHoldingPeriod(ev.date, trade.entryDate, trade.exitDate)
      ) {
        continue;
      }
      payments.push({
        date: exDateIso(ev.date),
        amountPerShare: ev.amount,
      });
    }

    payments.sort((a, b) => a.date.localeCompare(b.date));

    const perShareGross = payments.reduce(
      (s, p) => s + p.amountPerShare,
      0,
    );

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
      if (result === null || result.payments.length === 0) return;

      const grossTotal = Math.round(result.grossTotal * 100) / 100;
      const netTotal = netDividendFromGross(t.market, grossTotal);

      next[i] = {
        ...t,
        dividendGross: t.market === "US" ? grossTotal : undefined,
        dividendIncome: netTotal,
        dividendPayments: result.payments,
        dividendsAutoUpdated: today,
      };
      updated += 1;
      if (t.market === "US") usNetApplied += 1;
    }),
  );

  return { trades: next, updated, usNetApplied };
}

export type TradeDividendSummary = {
  netTotal: number;
  grossTotal?: number;
  perShareNet: number;
  perShareGross?: number;
  payments: DividendPaymentRecord[];
};

export function tradeDividendSummary(trade: Trade): TradeDividendSummary | null {
  if (trade.quantity <= 0) return null;

  if (trade.dividendPayments && trade.dividendPayments.length > 0) {
    const perShareGross = trade.dividendPayments.reduce(
      (sum, p) => sum + p.amountPerShare,
      0,
    );
    const grossTotal = Math.round(perShareGross * trade.quantity * 100) / 100;
    const netTotal = netDividendFromGross(trade.market, grossTotal);
    return {
      netTotal,
      grossTotal: trade.market === "US" ? grossTotal : undefined,
      perShareNet: Math.round((netTotal / trade.quantity) * 10000) / 10000,
      perShareGross:
        trade.market === "US"
          ? Math.round(perShareGross * 10000) / 10000
          : undefined,
      payments: trade.dividendPayments,
    };
  }

  if (trade.dividendIncome === undefined) return null;

  const netTotal = trade.dividendIncome;
  const grossTotal = trade.dividendGross;
  return {
    netTotal,
    grossTotal,
    perShareNet: Math.round((netTotal / trade.quantity) * 10000) / 10000,
    perShareGross:
      grossTotal !== undefined
        ? Math.round((grossTotal / trade.quantity) * 10000) / 10000
        : undefined,
    payments: [],
  };
}
