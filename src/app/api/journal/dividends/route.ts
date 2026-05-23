import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Bulk auto-fill removed — add payments per trade in the journal form. */
export async function POST() {
  return NextResponse.json({
    updated: 0,
    message:
      "Enter dividend payments on each trade from your broker. Use Load Yahoo hints in the form if needed.",
  });
}
