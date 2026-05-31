"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { persistFinanceData } from "@/lib/client-finance";
import { CATEGORY_LABELS } from "@/lib/finance";
import {
  DEFAULT_MAX_STOCKS_FUNDS_PCT,
  DEFAULT_SG_SHARE_OF_STOCKS_FUNDS_PCT,
} from "@/lib/most-liquid-allocation";
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
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [annualBonus, setAnnualBonus] = useState("");
  const [projectionReturnPct, setProjectionReturnPct] = useState("5");
  const [maxStocksFundsPct, setMaxStocksFundsPct] = useState(
    String(DEFAULT_MAX_STOCKS_FUNDS_PCT),
  );
  const [sgShareOfStocksFundsPct, setSgShareOfStocksFundsPct] = useState(
    String(DEFAULT_SG_SHARE_OF_STOCKS_FUNDS_PCT),
  );
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        setBirthYear(json.settings?.birthYear?.toString() ?? "");
        setEmergencyMonths(
          String(json.settings?.emergencyFundMonths ?? 6),
        );
        setMonthlyIncome(json.settings?.monthlyIncome?.toString() ?? "");
        setAnnualBonus(json.settings?.annualBonus?.toString() ?? "");
        setProjectionReturnPct(
          String(json.settings?.projectionReturnPct ?? 5),
        );
        setMaxStocksFundsPct(
          String(
            json.settings?.mostLiquidPlan?.maxStocksFundsPct ??
              DEFAULT_MAX_STOCKS_FUNDS_PCT,
          ),
        );
        setSgShareOfStocksFundsPct(
          String(
            json.settings?.mostLiquidPlan?.sgShareOfStocksFundsPct ??
              DEFAULT_SG_SHARE_OF_STOCKS_FUNDS_PCT,
          ),
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
    setMessage("");

    const allocationTargets: FinanceData["allocationTargets"] = {};
    for (const c of TARGET_CATEGORIES) {
      const raw = targets[c]?.trim();
      if (raw) allocationTargets[c] = Number(raw);
    }

    const next: FinanceData = {
      ...data,
      settings: {
        ...data.settings,
        birthYear: birthYear ? Number(birthYear) : undefined,
        emergencyFundMonths: Number(emergencyMonths) || 6,
        monthlyIncome: monthlyIncome
          ? Number(monthlyIncome.replace(/,/g, ""))
          : undefined,
        annualBonus: annualBonus
          ? Number(annualBonus.replace(/,/g, ""))
          : undefined,
        projectionReturnPct: projectionReturnPct
          ? Number(projectionReturnPct)
          : 5,
        mostLiquidPlan: {
          maxStocksFundsPct: Number(maxStocksFundsPct) || DEFAULT_MAX_STOCKS_FUNDS_PCT,
          sgShareOfStocksFundsPct:
            Number(sgShareOfStocksFundsPct) ||
            DEFAULT_SG_SHARE_OF_STOCKS_FUNDS_PCT,
        },
      },
      allocationTargets:
        Object.keys(allocationTargets).length > 0
          ? allocationTargets
          : undefined,
    };

    const result = await persistFinanceData(next);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setData(result.data);
    setMessage("Saved. Check the dashboard for projections.");
  }

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Income and expenses power{" "}
          <Link href="/" className="text-accent hover:underline">
            future projections
          </Link>{" "}
          on the dashboard. Account balances are on{" "}
          <Link href="/accounts" className="text-accent hover:underline">
            Accounts
          </Link>{" "}
          or{" "}
          <Link href="/update" className="text-accent hover:underline">
            Update
          </Link>
          .
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <legend className="px-1 text-sm font-medium text-zinc-300">
            Privacy
          </legend>
          <p className="mt-1 text-xs text-zinc-500">
            Hide dollar amounts and percentages across the app (shown as{" "}
            <span className="font-mono">xxx</span>). Useful when sharing your
            screen.
          </p>
          <div className="mt-3">
            <PrivacyToggle />
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <legend className="px-1 text-sm font-medium text-zinc-300">
            Income &amp; projections
          </legend>
          <p className="mt-1 text-xs text-zinc-500">
            Gross figures in SGD. Monthly expenses come from your latest snapshot
            (Update or Accounts).
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-400">Gross monthly income</span>
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full font-mono"
                placeholder="12000"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">Annual bonus (optional)</span>
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full font-mono"
                placeholder="24000"
                value={annualBonus}
                onChange={(e) => setAnnualBonus(e.target.value)}
              />
              <span className="mt-0.5 block text-xs text-muted">
                Spread evenly across 12 months in projections
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">Expected return % / year</span>
              <input
                type="number"
                step="0.5"
                min={0}
                max={30}
                className="mt-1 w-full font-mono"
                value={projectionReturnPct}
                onChange={(e) => setProjectionReturnPct(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

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
            Most liquid allocation plan
          </legend>
          <p className="mt-1 text-xs text-zinc-500">
            Targets for the{" "}
            <Link href="/" className="text-accent hover:underline">
              most liquid allocation
            </Link>{" "}
            chart (cash + investment accounts).
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-zinc-400">Max stocks &amp; funds %</span>
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full font-mono"
                value={maxStocksFundsPct}
                onChange={(e) => setMaxStocksFundsPct(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">SG share of stocks &amp; funds %</span>
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full font-mono"
                value={sgShareOfStocksFundsPct}
                onChange={(e) => setSgShareOfStocksFundsPct(e.target.value)}
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
        {message ? (
          <p
            className={`text-sm ${
              message.includes("failed") || message.includes("Blob")
                ? "text-negative"
                : "text-positive"
            }`}
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}