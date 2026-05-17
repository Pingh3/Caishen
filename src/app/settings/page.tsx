"use client";

import { FormEvent, useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/finance";
import type { AccountCategory, FinanceData } from "@/lib/types";

const TARGET_CATEGORIES: AccountCategory[] = [
  "cash",
  "investments",
  "retirement",
];

export default function SettingsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [emergencyMonths, setEmergencyMonths] = useState("6");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        setBirthYear(json.settings?.birthYear?.toString() ?? "");
        setEmergencyMonths(
          String(json.settings?.emergencyFundMonths ?? 6),
        );
        const t: Record<string, string> = {};
        for (const c of TARGET_CATEGORIES) {
          const v = json.allocationTargets?.[c];
          if (v !== undefined) t[c] = String(v);
        }
        setTargets(t);
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setSaved(false);

    const allocationTargets: FinanceData["allocationTargets"] = {};
    for (const c of TARGET_CATEGORIES) {
      const raw = targets[c]?.trim();
      if (raw) allocationTargets[c] = Number(raw);
    }

    const next: FinanceData = {
      ...data,
      settings: {
        birthYear: birthYear ? Number(birthYear) : undefined,
        emergencyFundMonths: Number(emergencyMonths) || 6,
      },
      allocationTargets:
        Object.keys(allocationTargets).length > 0
          ? allocationTargets
          : undefined,
    };

    await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    setData(next);
    setSaving(false);
    setSaved(true);
  }

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Personalize insights and allocation targets.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <legend className="px-1 text-sm font-medium text-zinc-300">
            Profile
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-zinc-400">Birth year</span>
              <input
                type="number"
                className="mt-1 w-full font-mono"
                placeholder="1990"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">Emergency fund target (months)</span>
              <input
                type="number"
                className="mt-1 w-full font-mono"
                min={1}
                max={24}
                value={emergencyMonths}
                onChange={(e) => setEmergencyMonths(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <legend className="px-1 text-sm font-medium text-zinc-300">
            Allocation targets (% of investable)
          </legend>
          <p className="mt-1 text-xs text-zinc-500">
            Optional. Dashboard flags categories more than 8% off target.
          </p>
          <div className="mt-3 space-y-3">
            {TARGET_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{CATEGORY_LABELS[c]}</span>
                <input
                  type="number"
                  className="w-20 font-mono text-right"
                  min={0}
                  max={100}
                  placeholder="—"
                  value={targets[c] ?? ""}
                  onChange={(e) =>
                    setTargets((t) => ({ ...t, [c]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved ? (
          <p className="text-sm text-positive">Saved.</p>
        ) : null}
      </form>
    </div>
  );
}
