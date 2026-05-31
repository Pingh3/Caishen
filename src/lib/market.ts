import type { Holding, QuoteResult, StockMarket, Trade } from "./types";

export type FxRates = {
  usdToSgd: number;
  hkdToSgd: number;
};

const DEFAULT_USD_SGD = 1.35;
const DEFAULT_USD_HKD = 7.8;

export function defaultFxRates(): FxRates {
  return {
    usdToSgd: DEFAULT_USD_SGD,
    hkdToSgd: DEFAULT_USD_SGD / DEFAULT_USD_HKD,
  };
}

export async function fetchFxRates(): Promise<FxRates> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=SGD,HKD",
      { next: { revalidate: 300 } },
    );
    if (!res.ok) throw new Error("fx failed");
    const json = (await res.json()) as {
      rates?: { SGD?: number; HKD?: number };
    };
    const usdToSgd = json.rates?.SGD ?? DEFAULT_USD_SGD;
    const usdToHkd = json.rates?.HKD ?? DEFAULT_USD_HKD;
    return {
      usdToSgd,
      hkdToSgd: usdToSgd / usdToHkd,
    };
  } catch {
    return defaultFxRates();
  }
}

export async function fetchUsdToSgd(): Promise<number> {
  return (await fetchFxRates()).usdToSgd;
}

export function normalizeSymbol(symbol: string): string {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/\.SI$/i, "")
    .replace(/\.HK$/i, "");
}

/** Common names typed instead of SGX tickers (Yahoo uses numeric codes). */
const SG_TICKER_ALIASES: Record<string, string> = {
  DBS: "D05",
  UOB: "U11",
  OCBC: "O39",
  SIA: "C6L",
  SINGTEL: "Z74",
  CAPLAND: "C31",
  CAPITALAND: "C31",
  WILMAR: "F34",
  SATS: "S58",
  KEPPEL: "BN4",
  SEMBCORP: "U96",
  MAPLETREE: "ME8U",
};

/** Map company-style symbols to Yahoo SGX tickers (e.g. DBS → D05). */
export function normalizeSgTicker(symbol: string): string {
  const base = normalizeSymbol(symbol);
  return SG_TICKER_ALIASES[base] ?? base;
}

export function yahooChartSymbol(symbol: string, market: StockMarket): string {
  const base = normalizeSymbol(symbol);
  if (market === "SG") return `${normalizeSgTicker(base)}.SI`;
  if (market === "HK") {
    if (/^\d+$/.test(base)) return `${base.padStart(4, "0")}.HK`;
    return `${base}.HK`;
  }
  return base;
}

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** Resolve a working Yahoo chart symbol (uses meta.symbol when Yahoo canonicalizes). */
export async function resolveYahooChartSymbol(
  symbol: string,
  market: StockMarket,
): Promise<string> {
  const primary = yahooChartSymbol(symbol, market);
  if (market !== "SG") return primary;

  const candidates = [
    primary,
    `${normalizeSymbol(symbol)}.SI`,
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const ySym of candidates) {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&range=5d`,
        { headers: YAHOO_HEADERS, next: { revalidate: 3600 } },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as YahooChart;
      const meta = json.chart?.result?.[0]?.meta;
      if (meta?.symbol) return meta.symbol;
      if (meta?.regularMarketPrice !== undefined) return ySym;
    } catch {
      /* try next candidate */
    }
  }

  return primary;
}

export function fxForMarket(market: StockMarket, fx: FxRates): number {
  if (market === "US") return fx.usdToSgd;
  if (market === "HK") return fx.hkdToSgd;
  return 1;
}

export function nativeToSgd(
  amount: number,
  market: StockMarket,
  fx: FxRates,
): number {
  return amount * fxForMarket(market, fx);
}

type YahooChart = {
  chart?: {
    result?: {
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        currency?: string;
        shortName?: string;
      };
    }[];
  };
};

export type MarketDetection = {
  market: StockMarket;
  quote: QuoteResult;
};

function quoteCurrency(
  metaCurrency: string | undefined,
  market: StockMarket,
): QuoteResult["currency"] {
  const c = metaCurrency?.toUpperCase();
  if (c === "SGD" || c === "USD" || c === "HKD") return c;
  if (market === "SG") return "SGD";
  if (market === "HK") return "HKD";
  return "USD";
}

export async function fetchQuote(
  symbol: string,
  market: StockMarket,
  fx: FxRates,
): Promise<QuoteResult | null> {
  const base = normalizeSymbol(symbol);
  const ySym = yahooChartSymbol(base, market);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&range=1d`,
      {
        headers: YAHOO_HEADERS,
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;

    const json = (await res.json()) as YahooChart;
    const meta = json.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (price === undefined || !meta) return null;

    const prev = meta.chartPreviousClose ?? price;
    const changePercent = prev ? ((price - prev) / prev) * 100 : null;
    const currency = quoteCurrency(meta.currency, market);
    const priceSgd =
      currency === "SGD"
        ? price
        : currency === "HKD"
          ? price * fx.hkdToSgd
          : price * fx.usdToSgd;

    return {
      symbol: base,
      market,
      price,
      currency,
      priceSgd,
      changePercent,
      name: meta.shortName,
    };
  } catch {
    return null;
  }
}

function looksLikeSgCode(base: string): boolean {
  return (
    /^[A-Z]\d{2}[A-Z]?$/.test(base) ||
    (base.length <= 4 &&
      /^[A-Z0-9]+$/.test(base) &&
      !/^[A-Z]{4,5}$/.test(base) &&
      !/^\d+$/.test(base))
  );
}

function looksLikeUsTicker(base: string): boolean {
  return /^[A-Z]{4,5}$/.test(base);
}

function pickMarket(
  base: string,
  candidates: MarketDetection[],
): MarketDetection {
  if (candidates.length === 1) return candidates[0];

  const byCurrency = candidates.filter((c) => {
    if (c.market === "SG") return c.quote.currency === "SGD";
    if (c.market === "HK") return c.quote.currency === "HKD";
    return c.quote.currency === "USD";
  });
  const pool = byCurrency.length > 0 ? byCurrency : candidates;

  if (/^\d{1,4}$/.test(base)) {
    const hk = pool.find((c) => c.market === "HK");
    if (hk) return hk;
  }
  if (looksLikeSgCode(base)) {
    const sg = pool.find((c) => c.market === "SG");
    if (sg) return sg;
  }
  if (looksLikeUsTicker(base)) {
    const us = pool.find((c) => c.market === "US");
    if (us) return us;
  }

  const hk = pool.find((c) => c.market === "HK");
  const us = pool.find((c) => c.market === "US");
  if (hk && us && /^[A-Z]{2,3}$/.test(base)) return hk;

  const order: StockMarket[] = ["SG", "HK", "US"];
  for (const m of order) {
    const hit = pool.find((c) => c.market === m);
    if (hit) return hit;
  }
  return pool[0];
}

/** Infer SG / HK / US listing via Yahoo Finance. */
export async function detectMarket(
  symbol: string,
  fx: FxRates,
): Promise<MarketDetection | null> {
  const raw = symbol.trim();
  const base = normalizeSymbol(raw);
  if (!base) return null;

  if (/\.SI$/i.test(raw)) {
    const quote = await fetchQuote(base, "SG", fx);
    return quote ? { market: "SG", quote } : null;
  }
  if (/\.HK$/i.test(raw)) {
    const quote = await fetchQuote(base, "HK", fx);
    return quote ? { market: "HK", quote } : null;
  }

  const [sgQuote, hkQuote, usQuote] = await Promise.all([
    fetchQuote(base, "SG", fx),
    fetchQuote(base, "HK", fx),
    fetchQuote(base, "US", fx),
  ]);

  const candidates: MarketDetection[] = [];
  if (sgQuote) candidates.push({ market: "SG", quote: sgQuote });
  if (hkQuote) candidates.push({ market: "HK", quote: hkQuote });
  if (usQuote) candidates.push({ market: "US", quote: usQuote });

  if (candidates.length === 0) return null;
  return pickMarket(base, candidates);
}

function needsDescription(trade: Trade): boolean {
  const d = trade.description?.trim();
  if (!d) return true;
  return d.toUpperCase() === trade.symbol.toUpperCase();
}

/** Fill missing trade descriptions from Yahoo Finance shortName. */
export async function enrichTradeDescriptions(trades: Trade[]): Promise<Trade[]> {
  const fx = await fetchFxRates();
  const nameCache = new Map<string, string | null>();
  const next = [...trades];

  for (let i = 0; i < next.length; i++) {
    const t = next[i];
    if (t.category !== "stocks" || !needsDescription(t)) continue;

    const key = `${t.market}:${normalizeSymbol(t.symbol)}`;
    if (!nameCache.has(key)) {
      const quote = await fetchQuote(t.symbol, t.market, fx);
      nameCache.set(key, quote?.name?.trim() ?? null);
    }
    const name = nameCache.get(key);
    if (name) next[i] = { ...t, description: name };
  }

  return next;
}

export async function fetchQuotesForHoldings(
  holdings: Holding[],
): Promise<QuoteResult[]> {
  const fx = await fetchFxRates();
  const results = await Promise.all(
    holdings.map((h) => fetchQuote(h.symbol, h.market, fx)),
  );
  return results.filter((q): q is QuoteResult => q !== null);
}

export function holdingValueSgd(
  holding: Holding,
  quote: QuoteResult | undefined,
): number {
  if (!quote) return 0;
  return holding.quantity * quote.priceSgd;
}

export function entryPriceSgd(
  holding: Holding,
  fx: FxRates,
): number {
  return nativeToSgd(holding.avgEntryPrice, holding.market, fx);
}

export function holdingCostSgd(holding: Holding, fx: FxRates): number {
  return holding.quantity * entryPriceSgd(holding, fx);
}

export function holdingPnl(
  holding: Holding,
  quote: QuoteResult | undefined,
  fx: FxRates,
): { pnlSgd: number; pnlPercent: number | null; costSgd: number; valueSgd: number } {
  const costSgd = holdingCostSgd(holding, fx);
  const valueSgd = holdingValueSgd(holding, quote);
  const pnlSgd = valueSgd - costSgd;
  const pnlPercent = costSgd > 0 ? (pnlSgd / costSgd) * 100 : null;
  return { pnlSgd, pnlPercent, costSgd, valueSgd };
}
