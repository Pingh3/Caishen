import type { DividendPayment, StockMarket, Trade } from "./types";
import { resolveYahooChartSymbol } from "./market";

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

function finiteMoney(n: unknown): number | undefined {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? roundMoney(x) : undefined;
}

function sumMoney(values: number[]): number | undefined {
  let total = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return undefined;
    total += value;
  }
  return roundMoney(total);
}

/** Repair legacy or partial payment rows; drop rows that cannot be recovered. */
export function sanitizeDividendPayments(
  trade: Pick<Trade, "market" | "quantity">,
  payments: DividendPayment[],
): DividendPayment[] {
  const qty = Number(trade.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return [];

  return payments.flatMap((payment) => {
    const legacyPerShare = finiteMoney(
      (payment as { amountPerShare?: number }).amountPerShare,
    );
    let grossPerShare = finiteMoney(payment.grossPerShare) ?? legacyPerShare;
    let grossTotal = finiteMoney(payment.grossTotal);
    let netTotal = finiteMoney(payment.netTotal);

    if (grossTotal !== undefined && grossPerShare === undefined) {
      grossPerShare = finiteMoney(grossTotal / qty);
    } else if (grossPerShare !== undefined && grossTotal === undefined) {
      grossTotal = finiteMoney(grossPerShare * qty);
    }

    if (
      grossTotal !== undefined &&
      netTotal === undefined &&
      grossPerShare !== undefined
    ) {
      netTotal = netDividendFromGross(trade.market, grossTotal);
    }

    if (
      grossPerShare === undefined ||
      grossTotal === undefined ||
      netTotal === undefined ||
      grossTotal <= 0 ||
      netTotal <= 0
    ) {
      return [];
    }

    return [
      {
        ...payment,
        grossPerShare,
        grossTotal,
        netTotal,
      },
    ];
  });
}

/** Coerce trade dividend fields after load or fill. */
export function normalizeTradeDividends(trade: Trade): Trade {
  const quantity = Number(trade.quantity);
  const base =
    Number.isFinite(quantity) && quantity > 0
      ? { ...trade, quantity }
      : trade;

  if (base.dividendPayments?.length) {
    const payments = sanitizeDividendPayments(base, base.dividendPayments);
    if (payments.length > 0) {
      return { ...base, ...syncTradeDividendTotals(base, payments) };
    }
    return clearTradeDividends(base);
  }

  if (base.dividendIncome !== undefined) {
    const income = finiteMoney(base.dividendIncome);
    if (income === undefined || income < 0) {
      return clearTradeDividends(base);
    }
    const next = { ...base, dividendIncome: income };
    const gross = finiteMoney(base.dividendGross);
    if (base.market === "US" && gross !== undefined) {
      next.dividendGross = gross;
    } else {
      delete next.dividendGross;
    }
    return next;
  }

  return base;
}

function dividendPerShare(n: unknown): number | undefined {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x <= 0) return undefined;
  return Math.round(x * 1_000_000) / 1_000_000;
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
  const clean = sanitizeDividendPayments(trade, payments);
  if (clean.length === 0) {
    return {
      dividendPayments: [],
      dividendIncome: undefined,
      dividendGross: undefined,
    };
  }

  const grossTotal = sumMoney(clean.map((p) => p.grossTotal));
  const netTotal = sumMoney(clean.map((p) => p.netTotal));
  if (grossTotal === undefined || netTotal === undefined) {
    return {
      dividendPayments: [],
      dividendIncome: undefined,
      dividendGross: undefined,
    };
  }

  return {
    dividendPayments: clean,
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
  const qty = Number(trade.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const payments = sanitizeDividendPayments(trade, trade.dividendPayments ?? []);
  if (payments.length > 0) {
    const netTotal = sumMoney(payments.map((p) => p.netTotal));
    const grossTotal = sumMoney(payments.map((p) => p.grossTotal));
    if (netTotal === undefined || grossTotal === undefined) return null;

    const perShareNet = roundMoney(netTotal / qty);
    const perShareGross = roundMoney(grossTotal / qty);
    if (!Number.isFinite(perShareNet)) return null;

    const isUs = trade.market === "US";
    return {
      netTotal,
      grossTotal: isUs ? grossTotal : netTotal,
      perShareNet,
      perShareGross: isUs ? perShareGross : perShareNet,
      payments,
    };
  }

  const netTotal = finiteMoney(trade.dividendIncome);
  if (netTotal === undefined) return null;

  const perShareNet = roundMoney(netTotal / qty);
  if (!Number.isFinite(perShareNet)) return null;

  const grossStored = finiteMoney(trade.dividendGross);
  const isUs = trade.market === "US";
  const grossTotal = isUs ? (grossStored ?? netTotal) : netTotal;
  const perShareGross = roundMoney(grossTotal / qty);

  return {
    netTotal,
    grossTotal,
    perShareNet,
    perShareGross: isUs ? perShareGross : perShareNet,
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

  const ySym = await resolveYahooChartSymbol(trade.symbol, trade.market);

  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(ySym) +
      "?interval=1d&range=max&events=div";
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as YahooDivEvent;
    const events = json.chart?.result?.[0]?.events?.dividends ?? {};
    const suggested: DividendPayment[] = [];

    const qty = Number(trade.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return [];

    for (const ev of Object.values(events)) {
      const amount = dividendPerShare(ev.amount);
      if (amount === undefined) continue;
      if (!Number.isFinite(ev.date)) continue;

      const exDate = new Date(ev.date * 1000).toISOString().slice(0, 10);
      if (!isEligibleForExDate(exDate, trade.entryDate, trade.exitDate)) {
        continue;
      }

      const grossPerShare = amount;
      const grossTotal = roundMoney(grossPerShare * qty);
      const netTotal = netDividendFromGross(trade.market, grossTotal);
      if (!Number.isFinite(netTotal) || netTotal <= 0) continue;

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
  return tradeDividendSummary(trade) !== null;
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

export type DividendFillSkip = {
  tradeId: string;
  symbol: string;
  reason: string;
};

function skipReasonForTrade(trade: Trade, yahooSym: string): string {
  return `No ex-dividends in ${holdingPeriodLabel(trade)} (Yahoo: ${yahooSym})`;
}

/** Yahoo ex-dates in holding window → payments (SG only). */
export async function fillTradeDividendsFromYahoo(
  trade: Trade,
): Promise<{ trade: Trade | null; skip?: DividendFillSkip }> {
  if (!isFillableStockTrade(trade)) {
    return {
      trade: null,
      skip: {
        tradeId: trade.id,
        symbol: trade.symbol,
        reason: "Not an SG stock trade",
      },
    };
  }

  const yahooSym = await resolveYahooChartSymbol(trade.symbol, trade.market);
  const payments = await suggestDividendsFromYahoo(trade);
  if (payments.length === 0) {
    return {
      trade: null,
      skip: {
        tradeId: trade.id,
        symbol: trade.symbol,
        reason: skipReasonForTrade(trade, yahooSym),
      },
    };
  }

  return {
    trade: normalizeTradeDividends({
      ...trade,
      ...syncTradeDividendTotals(trade, payments),
    }),
  };
}

export async function fillDividendsOnTrades(
  trades: Trade[],
  tradeIds: Set<string>,
): Promise<{
  trades: Trade[];
  filled: number;
  skipped: number;
  skips: DividendFillSkip[];
}> {
  let filled = 0;
  let skipped = 0;
  const skips: DividendFillSkip[] = [];

  const next = await Promise.all(
    trades.map(async (t) => {
      if (!tradeIds.has(t.id) || !isFillableStockTrade(t)) return t;
      const result = await fillTradeDividendsFromYahoo(t);
      if (!result.trade) {
        skipped += 1;
        if (result.skip) skips.push(result.skip);
        return t;
      }
      filled += 1;
      return result.trade;
    }),
  );

  return { trades: next, filled, skipped, skips };
}
