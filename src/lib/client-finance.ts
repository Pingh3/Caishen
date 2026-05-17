import { normalizeFinanceData } from "./normalize";
import type { FinanceData } from "./types";

export async function loadFinanceData(): Promise<FinanceData> {
  const res = await fetch("/api/finance", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load your data.");
  return normalizeFinanceData((await res.json()) as FinanceData);
}

export async function persistFinanceData(
  data: FinanceData,
): Promise<{ ok: true; data: FinanceData } | { ok: false; error: string }> {
  const payload = normalizeFinanceData(data);
  const res = await fetch("/api/finance", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: json.error ?? `Save failed (${res.status}). Check Blob on Vercel.`,
    };
  }
  return { ok: true, data: payload };
}
