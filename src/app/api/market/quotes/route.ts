import { NextResponse } from "next/server";
import { fetchFxRates, fetchQuotesForHoldings } from "@/lib/market";
import { readFinanceData } from "@/lib/storage";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readFinanceData();
  const holdings = data.holdings ?? [];
  const fx = await fetchFxRates();
  if (holdings.length === 0) {
    return NextResponse.json({ quotes: [], ...fx });
  }
  const quotes = await fetchQuotesForHoldings(holdings);
  return NextResponse.json({ quotes, ...fx });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { holdings?: Holding[] };
  const holdings = body.holdings ?? [];
  const fx = await fetchFxRates();
  const quotes = await fetchQuotesForHoldings(holdings);
  return NextResponse.json({ quotes, ...fx });
}
