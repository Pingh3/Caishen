import type { DividendPayment, StockMarket, Trade } from "./types";
import { normalizeSymbol } from "./market";

/** US dividend withholding for non-US tax residents (e.g. via broker). */
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

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function yahooSymbol(symbol: string, market: StockMarket): string {
  const base = normalizeSymbol(symbol);
  if (market === "SG") return `${base}.SI`;
  if (market === "HK") {
    if (/^\d+$/.test(base)) return `${base.padStart(4, "0")}.HK`;
    return `${base}.HK`;
  }
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

/** Must have held shares on the ex-dividend date. */
export function isEligibleForExDate(
  exDate: string,
  entryDate: string,
  exitDate?: string,
): boolean {
  const exUnix = tradeDateUnix(exDate, "start");
  const entryStart = tradeDateUnix(entryDate, "start");
  const exitEnd = exitDate
    ? tradeDateUnix(exitDate, "end")
    : Math.floor(Date.now() / 1000);
  return exUnix >= entryStart && exUnix <= exitEnd;
}

export function newDividendPaymentId(): string {
  return `div-${Date.now().toString(36)}`;
}

/** Build one payment from broker gross total (preferred) or gross per share. */
export function buildDividendPayment(
  trade: Pick<Trade, "market" | "quantity">,
  input: {
    paymentDate: string;
    exDate?: string;
    grossTotal?: number;
    grossPerShare?: number;
    source?: DividendPayment["source"];
  },
): DividendPayment | string {
  if (!input.paymentDate.trim()) return "Payment date is required.";
  if (trade.quantity <= 0) return "Quantity must be greater than zero.";

  let grossTotal: number;
  let grossPerShare: number;

  if (input.grossTotal !== undefined && input.grossTotal > 0) {
    grossTotal = roundMoney(input.grossTotal);
    grossPerShare = roundMoney(grossTotal / trade.quantity);
  } else if (input.grossPerShare !== undefined && input.grossPerShare > 0) {
    grossPerShare = roundMoney(input.grossPerShare);
    grossTotal = roundMoney(grossPerShare * trade.quantity);
  } else {
    return "Enter gross total or gross per share from your broker.";
  }

  const netTotal = netDividendFromGross(trade.market, grossTotal);

  return {
    id: newDividendPaymentId(),
    paymentDate: input.paymentDate.trim(),
    exDate: input.exDate?.trim() || undefined,
    grossPerShare,
    grossTotal,
    netTotal,
    source: input.source ?? "manual",
  };
}

export function syncTradeDividendTotals(
  trade: Trade,
  payments: DividendPayment[],
): Pick<Trade, "dividendPayments" | "dividendIncome" | "dividendGross"> {
  if (payments.length === 0) {
    return {
      dividendPayments: [],
      dividendIncome: undefined,
      dividendGross: undefined,
    };
  }

  const grossTotal = roundMoney(
    payments.reduce((s, p) => s + p.grossTotal, 0),
  );
  const netTotal = roundMoney(payments.reduce((s, p) => s + p.netTotal, 0));

  return {
    dividendPayments: payments,
    dividendIncome: netTotal,
    dividendGross: trade.market === "US" ? grossTotal : undefined,
  };
}

export type TradeDividendSummary = {
  netTotal: number;
  grossTotal?: number;
  perShareNet: number;
  perShareGross?: number;
  payments: DividendPayment[];
};

export function tradeDividendSummary(trade: Trade): TradeDividendSummary | null {
  const payments = trade.dividendPayments ?? [];
  if (payments.length > 0) {
    const netTotal = roundMoney(payments.reduce((s, p) => s + p.netTotal, 0));
    const grossTotal = roundMoney(
      payments.reduce((s, p) => s + p.grossTotal, 0),
    );
    return {
      netTotal,
      grossTotal: trade.market === "US" ? grossTotal : undefined,
      perShareNet: roundMoney(netTotal / trade.quantity),
      perShareGross:
        trade.market === "US"
          ? roundMoney(grossTotal / trade.quantity)
          : undefined,
      payments,
    };
  }

  if (trade.dividendIncome === undefined) return null;
  const netTotal = trade.dividendIncome;
  const grossTotal = trade.dividendGross;
  return {
    netTotal,
    grossTotal,
    perShareNet: roundMoney(netTotal / trade.quantity),
    perShareGross:
      grossTotal !== undefined
        ? roundMoney(grossTotal / trade.quantity)
        : undefined,
    payments: [],
  };
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

/** Yahoo ex-dates only — verify cash date and amount against your broker. */
export async function suggestDividendsFromYahoo(
  trade: Trade,
): Promise<DividendPayment[]> {
  if (trade.category !== "stocks") return [];

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
    if (!res.ok) return [];

    const json = (await res.json()) as YahooDivEvent;
    const events = json.chart?.result?.[0]?.events?.dividends ?? {};
    const suggested: DividendPayment[] = [];

    for (const ev of Object.values(events)) {
      const exDate = new Date(ev.date * 1000).toISOString().slice(0, 10);
      if (!isEligibleForExDate(exDate, trade.entryDate, trade.exitDate)) {
        continue;
      }

      const grossPerShare = roundMoney(ev.amount);
      const grossTotal = roundMoney(grossPerShare * trade.quantity);
      const netTotal = netDividendFromGross(trade.market, grossTotal);

      suggested.push({
        id: newDividendPaymentId(),
        paymentDate: exDate,
        exDate,
        grossPerShare,
        grossTotal,
        netTotal,
        source: "yahoo",
      });
    }

    suggested.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
    return suggested;
  } catch {
    return [];
  }
}

export function holdingPeriodLabel(trade: Trade): string {
  return `${trade.entryDate} to ${trade.exitDate ?? "today"}`;
}

export function tradeHasDividends(trade: Trade): boolean {
  if ((trade.dividendPayments?.length ?? 0) > 0) return true;
  return trade.dividendIncome !== undefined;
}

/** Remove all dividend fields from a trade. */
export function clearTradeDividends(trade: Trade): Trade {
  const next = { ...trade };
  delete next.dividendIncome;
  delete next.dividendGross;
  delete next.dividendPayments;
  delete next.dividendsAutoUpdated;
  return next;
}

export function clearDividendsOnTrades(
  trades: Trade[],
  tradeIds: Set<string>,
): { trades: Trade[]; cleared: number } {
  let cleared = 0;
  const next = trades.map((t) => {
    if (!tradeIds.has(t.id) || !tradeHasDividends(t)) return t;
    cleared += 1;
    return clearTradeDividends(t);
  });
  return { trades: next, cleared };
}

/** Yahoo fill is SG stocks only; US dividends are entered manually. */
export function isFillableStockTrade(trade: Trade): boolean {
  return trade.category === "stocks" && trade.market === "SG";
}

/** Yahoo ex-dates in holding window → payments (SG only). */
export async function fillTradeDividendsFromYahoo(
  trade: Trade,
): Promise<Trade | null> {
  if (!isFillableStockTrade(trade)) return null;
  const payments = await suggestDividendsFromYahoo(trade);
  if (payments.length === 0) return null;
  return {
    ...trade,
    ...syncTradeDividendTotals(trade, payments),
  };
}

export async function fillDividendsOnTrades(
  trades: Trade[],
  tradeIds: Set<string>,
): Promise<{ trades: Trade[]; filled: number; skipped: number }> {
  let filled = 0;
  let skipped = 0;

  const next = await Promise.all(
    trades.map(async (t) => {
      if (!tradeIds.has(t.id) || !isFillableStockTrade(t)) return t;
      const updated = await fillTradeDividendsFromYahoo(t);
      if (!updated) {
        skipped += 1;
        return t;
      }
      filled += 1;
      return updated;
    }),
  );

  return { trades: next, filled, skipped };
}
