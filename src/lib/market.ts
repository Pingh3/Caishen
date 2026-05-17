import type { Holding, QuoteResult, StockMarket, Trade } from "./types";

function yahooSymbol(symbol: string, market: StockMarket): string {
  const s = normalizeSymbol(symbol);
  if (market === "SG") {
    return `${s}.SI`;
  }
  return s;
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.SI$/i, "");
}

type YahooChart = {
  chart?: {
    result?: {
      meta?: {
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

export async function fetchUsdToSgd(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=SGD",
      { next: { revalidate: 300 } },
    );
    if (!res.ok) throw new Error("fx failed");
    const json = (await res.json()) as { rates?: { SGD?: number } };
    return json.rates?.SGD ?? 1.35;
  } catch {
    return 1.35;
  }
}

export async function fetchQuote(
  symbol: string,
  market: StockMarket,
  usdToSgd: number,
): Promise<QuoteResult | null> {
  const base = normalizeSymbol(symbol);
  const ySym = yahooSymbol(base, market);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&range=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
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
    const currency = market === "SG" ? "SGD" : "USD";
    const priceSgd = currency === "SGD" ? price : price * usdToSgd;

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

/** Try Yahoo quotes to infer SG (.SI) vs US listing. */
export async function detectMarket(
  symbol: string,
  usdToSgd: number,
): Promise<MarketDetection | null> {
  const base = normalizeSymbol(symbol);
  if (!base) return null;

  if (/\.SI$/i.test(symbol.trim())) {
    const quote = await fetchQuote(base, "SG", usdToSgd);
    return quote ? { market: "SG", quote } : null;
  }

  const [sgQuote, usQuote] = await Promise.all([
    fetchQuote(base, "SG", usdToSgd),
    fetchQuote(base, "US", usdToSgd),
  ]);

  if (sgQuote && usQuote) {
    const looksSg =
      /^[A-Z]\d{2}[A-Z]?$/.test(base) ||
      (base.length <= 4 && /^[A-Z0-9]+$/.test(base) && !/^[A-Z]{4,5}$/.test(base));
    return looksSg
      ? { market: "SG", quote: sgQuote }
      : { market: "US", quote: usQuote };
  }
  if (sgQuote) return { market: "SG", quote: sgQuote };
  if (usQuote) return { market: "US", quote: usQuote };
  return null;
}

function needsDescription(trade: Trade): boolean {
  const d = trade.description?.trim();
  if (!d) return true;
  return d.toUpperCase() === trade.symbol.toUpperCase();
}

/** Fill missing trade descriptions from Yahoo Finance shortName. */
export async function enrichTradeDescriptions(trades: Trade[]): Promise<Trade[]> {
  const usdToSgd = await fetchUsdToSgd();
  const nameCache = new Map<string, string | null>();
  const next = [...trades];

  for (let i = 0; i < next.length; i++) {
    const t = next[i];
    if (t.category !== "stocks" || !needsDescription(t)) continue;

    const key = `${t.market}:${normalizeSymbol(t.symbol)}`;
    if (!nameCache.has(key)) {
      const quote = await fetchQuote(t.symbol, t.market, usdToSgd);
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
  const usdToSgd = await fetchUsdToSgd();
  const results = await Promise.all(
    holdings.map((h) => fetchQuote(h.symbol, h.market, usdToSgd)),
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
  usdToSgd: number,
): number {
  if (holding.market === "SG") return holding.avgEntryPrice;
  return holding.avgEntryPrice * usdToSgd;
}

export function holdingCostSgd(holding: Holding, usdToSgd: number): number {
  return holding.quantity * entryPriceSgd(holding, usdToSgd);
}

export function holdingPnl(
  holding: Holding,
  quote: QuoteResult | undefined,
  usdToSgd: number,
): { pnlSgd: number; pnlPercent: number | null; costSgd: number; valueSgd: number } {
  const costSgd = holdingCostSgd(holding, usdToSgd);
  const valueSgd = holdingValueSgd(holding, quote);
  const pnlSgd = valueSgd - costSgd;
  const pnlPercent = costSgd > 0 ? (pnlSgd / costSgd) * 100 : null;
  return { pnlSgd, pnlPercent, costSgd, valueSgd };
}
