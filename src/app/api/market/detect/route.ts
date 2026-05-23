import { NextResponse } from "next/server";
import { detectMarket, fetchFxRates } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const fx = await fetchFxRates();
  const result = await detectMarket(symbol, fx);
  if (!result) {
    return NextResponse.json(
      { error: "Could not find this ticker on SGX, HKEX, or US (Yahoo Finance)." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ...result, ...fx });
}
