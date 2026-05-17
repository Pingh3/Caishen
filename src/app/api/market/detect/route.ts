import { NextResponse } from "next/server";
import { detectMarket, fetchUsdToSgd } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const usdToSgd = await fetchUsdToSgd();
  const result = await detectMarket(symbol, usdToSgd);
  if (!result) {
    return NextResponse.json(
      { error: "Could not find this ticker on US or SGX (Yahoo Finance)." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ...result, usdToSgd });
}
