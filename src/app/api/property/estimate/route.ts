import { NextResponse } from "next/server";
import { estimateProperty } from "@/lib/sg-property";
import { readFinanceData, writeFinanceData } from "@/lib/storage";
import type { PropertyProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readFinanceData();
  if (!data.property?.postalCode) {
    return NextResponse.json(
      { error: "No property profile saved" },
      { status: 404 },
    );
  }
  const estimate = await estimateProperty(data.property);
  return NextResponse.json(estimate);
}

export async function POST(request: Request) {
  const body = (await request.json()) as PropertyProfile & {
    save?: boolean;
  };
  const { save, ...profile } = body;

  if (!profile.postalCode || !profile.houseType) {
    return NextResponse.json(
      { error: "postalCode and houseType required" },
      { status: 400 },
    );
  }

  const estimate = await estimateProperty(profile);

  if (save) {
    const data = await readFinanceData();
    await writeFinanceData({ ...data, property: profile });
  }

  return NextResponse.json(estimate);
}
