import { NextResponse } from "next/server";
import { readFinanceData, writeFinanceData } from "@/lib/storage";
import type { FinanceData } from "@/lib/types";

export async function GET() {
  const data = await readFinanceData();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as FinanceData;
    if (!body.accounts || !body.snapshots) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await writeFinanceData(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
