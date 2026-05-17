"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/finance";
import type { Account, FinanceData, Snapshot } from "@/lib/types";

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function UpdatePage() {
  const router = useRouter();
  const [data, setData] = useState<FinanceData | null>(null);
  const [date, setDate] = useState(todayIso());
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [notes, setNotes] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        const accounts = json.accounts.filter((a) => !a.archived);
        const latest = [...json.snapshots].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )[0];
        const initial: Record<string, string> = {};
        for (const a of accounts) {
          const prev = latest?.balances[a.id];
          initial[a.id] = prev !== undefined ? String(prev) : "";
        }
        setBalances(initial);
        if (latest?.monthlyExpenses) {
          setMonthlyExpenses(String(latest.monthlyExpenses));
        }
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setMessage("");

    const accounts = data.accounts.filter((a) => !a.archived);
    const parsed: Record<string, number> = {};
    for (const a of accounts) {
      const raw = balances[a.id]?.trim();
      if (!raw) continue;
      const n = Number(raw.replace(/,/g, ""));
      if (Number.isNaN(n)) {
        setMessage(`Invalid amount for ${a.name}`);
        setSaving(false);
        return;
      }
      parsed[a.id] = n;
    }

    const snapshot: Snapshot = {
      id: date,
      date,
      balances: parsed,
      notes: notes || undefined,
      monthlyExpenses: monthlyExpenses
        ? Number(monthlyExpenses.replace(/,/g, ""))
        : undefined,
    };

    const others = data.snapshots.filter((s) => s.id !== snapshot.id);
    const next: FinanceData = {
      ...data,
      snapshots: [...others, snapshot].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    };

    const res = await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setMessage("Failed to save. Try again.");
    }
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  const accounts = data.accounts.filter((a) => !a.archived);
  const byCategory = accounts.reduce(
    (acc, a) => {
      (acc[a.category] ??= []).push(a);
      return acc;
    },
    {} as Record<string, Account[]>,
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Monthly update</h2>
        <p className="mt-1 text-sm text-zinc-500">
          One snapshot per date. Balances pre-fill from your last entry.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-400">Snapshot date</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Monthly expenses (optional)</span>
            <input
              type="text"
              inputMode="decimal"
              className="mt-1 w-full font-mono"
              placeholder="4500"
              value={monthlyExpenses}
              onChange={(e) => setMonthlyExpenses(e.target.value)}
            />
          </label>
        </div>

        {Object.entries(byCategory).map(([cat, list]) => (
          <fieldset
            key={cat}
            className="rounded-xl border border-surface-border bg-surface-raised p-4"
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
            </legend>
            <div className="mt-3 space-y-3">
              {list.map((a) => (
                <label key={a.id} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-zinc-300">
                    {a.name}
                    {a.notes ? (
                      <span className="ml-1 text-zinc-600">({a.notes})</span>
                    ) : null}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-36 font-mono text-right"
                    placeholder="0"
                    value={balances[a.id] ?? ""}
                    onChange={(e) =>
                      setBalances((b) => ({ ...b, [a.id]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="block text-sm">
          <span className="text-zinc-400">Notes (optional)</span>
          <textarea
            className="mt-1 w-full"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {message ? <p className="text-sm text-negative">{message}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save snapshot"}
        </button>
      </form>
    </div>
  );
}
