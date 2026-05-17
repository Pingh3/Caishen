import { NextResponse } from "next/server";
import { enrichTradeDescriptions } from "@/lib/market";
import { readFinanceData, writeFinanceData } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const data = await readFinanceData();
    const before = data.trades ?? [];
    const after = await enrichTradeDescriptions(before);
    const updated = after.filter(
      (t, i) => (t.description ?? "") !== (before[i]?.description ?? ""),
    ).length;

    await writeFinanceData({ ...data, trades: after });

    return NextResponse.json({ updated, total: after.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not enrich descriptions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
