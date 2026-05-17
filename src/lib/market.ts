import type { Holding, QuoteResult, StockMarket } from "./types";

function yahooSymbol(symbol: string, market: StockMarket): string {
  const s = symbol.trim().toUpperCase();
  if (market === "SG") {
    return s.endsWith(".SI") ? s : `${s}.SI`;
  }
  return s;
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
  const ySym = yahooSymbol(symbol, market);
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
      symbol: symbol.toUpperCase(),
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
