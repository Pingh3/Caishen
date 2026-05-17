import { NextResponse } from "next/server";
import { enrichTradeDescriptions } from "@/lib/market";
import { mergeImportedTrades, parseJournalCsv } from "@/lib/trade-import";
import { readFinanceData, writeFinanceData } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      csv?: string;
      mode?: "merge" | "replace";
    };

    if (!body.csv?.trim()) {
      return NextResponse.json({ error: "CSV text is required." }, { status: 400 });
    }

    const mode = body.mode === "replace" ? "replace" : "merge";
    const parsed = parseJournalCsv(body.csv);
    if (parsed.trades.length === 0 && parsed.errors.length > 0) {
      return NextResponse.json(
        { error: parsed.errors[0], errors: parsed.errors },
        { status: 400 },
      );
    }

    const enriched = await enrichTradeDescriptions(parsed.trades);

    const data = await readFinanceData();
    const existing = data.trades ?? [];
    const { trades, added, duplicates } = mergeImportedTrades(
      existing,
      enriched,
      mode,
    );

    const withNames = await enrichTradeDescriptions(trades);
    await writeFinanceData({ ...data, trades: withNames });

    return NextResponse.json({
      added,
      duplicates,
      skipped: parsed.skipped,
      total: trades.length,
      errors: parsed.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
