import { NextResponse } from "next/server";
import { fillDividendsOnTrades } from "@/lib/dividends";
import { readFinanceData, writeFinanceData } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Fill SG stock dividends from Yahoo for selected trades. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tradeIds?: string[];
    };
    const tradeIds = body.tradeIds;
    if (!tradeIds?.length) {
      return NextResponse.json(
        { error: "tradeIds required." },
        { status: 400 },
      );
    }

    const data = await readFinanceData();
    const trades = data.trades ?? [];
    const ids = new Set(tradeIds);

    const { trades: nextTrades, filled, skipped, skips } =
      await fillDividendsOnTrades(trades, ids);

    await writeFinanceData({ ...data, trades: nextTrades });

    return NextResponse.json({
      filled,
      skipped,
      skips,
      note:
        "SG stocks only. US dividends are manual. Yahoo uses ex-dates in your holding window.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fill dividends failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
