import { NextResponse } from "next/server";
import { normalizeFinanceData } from "@/lib/normalize";
import { readFinanceData, writeFinanceData } from "@/lib/storage";
import type { FinanceData } from "@/lib/types";

export async function GET() {
  const data = await readFinanceData();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  try {
    const body = normalizeFinanceData((await request.json()) as FinanceData);
    if (!Array.isArray(body.accounts) || !Array.isArray(body.snapshots)) {
      return NextResponse.json(
        { error: "Invalid payload: accounts and snapshots required." },
        { status: 400 },
      );
    }
    await writeFinanceData(body);
    return NextResponse.json({ ok: true, data: body });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
