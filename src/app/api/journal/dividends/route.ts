import { NextResponse } from "next/server";
import { applyDividendsToTrades } from "@/lib/dividends";
import { readFinanceData, writeFinanceData } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const data = await readFinanceData();
    const trades = data.trades ?? [];
    if (trades.length === 0) {
      return NextResponse.json({ updated: 0, trades: [] });
    }

    const { trades: nextTrades, updated, usNetApplied } =
      await applyDividendsToTrades(trades);
    const next = { ...data, trades: nextTrades };
    await writeFinanceData(next);

    return NextResponse.json({ updated, usNetApplied, trades: nextTrades });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dividend update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
