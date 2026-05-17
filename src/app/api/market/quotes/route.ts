import { NextResponse } from "next/server";
import { fetchQuotesForHoldings, fetchUsdToSgd } from "@/lib/market";
import { readFinanceData } from "@/lib/storage";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readFinanceData();
  const holdings = data.holdings ?? [];
  if (holdings.length === 0) {
    return NextResponse.json({ quotes: [], usdToSgd: await fetchUsdToSgd() });
  }
  const quotes = await fetchQuotesForHoldings(holdings);
  const usdToSgd = await fetchUsdToSgd();
  return NextResponse.json({ quotes, usdToSgd });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { holdings?: Holding[] };
  const holdings = body.holdings ?? [];
  const quotes = await fetchQuotesForHoldings(holdings);
  const usdToSgd = await fetchUsdToSgd();
  return NextResponse.json({ quotes, usdToSgd });
}
