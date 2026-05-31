"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { persistFinanceData } from "@/lib/client-finance";
import type { FinanceData, InvestmentPhilosophy } from "@/lib/types";

const empty = {
  trading: "",
  investing: "",
};

export default function PhilosophyPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        const p = json.philosophy;
        if (p) {
          setForm({
            trading: p.trading ?? "",
            investing: p.investing ?? "",
          });
        }
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;

    const philosophy: InvestmentPhilosophy = {
      trading: form.trading.trim() || undefined,
      investing: form.investing.trim() || undefined,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    const hasContent = philosophy.trading || philosophy.investing;
    setSaving(true);
    const result = await persistFinanceData({
      ...data,
      philosophy: hasContent ? philosophy : undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error ?? "Could not save.");
      return;
    }
    setData(result.data);
    setMessage("Saved.");
  }

  async function onClear() {
    if (!data || !confirm("Clear all philosophy notes?")) return;
    setSaving(true);
    const result = await persistFinanceData({ ...data, philosophy: undefined });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error ?? "Could not save.");
      return;
    }
    setData(result.data);
    setForm(empty);
    setMessage("Cleared.");
  }

  const updatedAt = data?.philosophy?.updatedAt;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Philosophy</h2>
        <p className="mt-1 text-sm text-secondary">
          Your personal reference for how you trade and invest. Saved with your
          finance data — use it before new entries on the{" "}
          <Link href="/journal" className="text-accent hover:underline">
            Journal
          </Link>{" "}
          or when reviewing allocation on the{" "}
          <Link href="/" className="text-accent hover:underline">
            Dashboard
          </Link>
          .
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border border-surface-border bg-surface-raised p-5"
      >
        <label className="block text-sm">
          <span className="font-medium text-primary">Trading philosophy</span>
          <span className="mt-0.5 block text-xs text-muted">
            Position sizing, entries/exits, risk limits, markets you trade, what
            you avoid.
          </span>
          <textarea
            rows={10}
            value={form.trading}
            onChange={(e) => setForm({ ...form, trading: e.target.value })}
            placeholder="e.g. Only trade with a defined stop. Max 2% risk per position. No averaging down on losers…"
            className="mt-2 w-full resize-y font-sans leading-relaxed"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-primary">
            Investment philosophy
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Time horizon, core holdings, rebalancing, CPF/SRS, property vs
            equities.
          </span>
          <textarea
            rows={10}
            value={form.investing}
            onChange={(e) => setForm({ ...form, investing: e.target.value })}
            placeholder="e.g. 10+ year horizon. Core in broad ETFs. Keep 6 months expenses in cash. CPF SA top-up yearly…"
            className="mt-2 w-full resize-y font-sans leading-relaxed"
          />
        </label>

        {updatedAt ? (
          <p className="text-xs text-muted">Last updated {updatedAt}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {(form.trading || form.investing) && (
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-muted hover:text-primary"
            >
              Clear all
            </button>
          )}
        </div>

        {message ? (
          <p className="text-sm text-secondary" role="status">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
