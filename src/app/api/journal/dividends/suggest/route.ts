import { NextResponse } from "next/server";
import { suggestDividendsFromYahoo } from "@/lib/dividends";
import type { Trade } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Return Yahoo ex-date suggestions only — user must match broker cash amounts. */
export async function POST(req: Request) {
  try {
    const trade = (await req.json()) as Trade;
    if (!trade?.symbol || trade.category !== "stocks") {
      return NextResponse.json(
        { error: "Stock trade required." },
        { status: 400 },
      );
    }

    const suggestions = await suggestDividendsFromYahoo(trade);
    return NextResponse.json({
      suggestions,
      note:
        "Yahoo uses ex-dividend dates, not cash payment dates. Edit each row to match your broker (e.g. Qualcomm $0.89/share gross, 30% US WHT).",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Suggest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
