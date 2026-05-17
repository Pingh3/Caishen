"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { persistFinanceData } from "@/lib/client-finance";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SG_ACCOUNT_PRESETS,
  latestSnapshot,
  upsertLatestBalances,
} from "@/lib/finance";
import type { Account, AccountCategory, FinanceData } from "@/lib/types";

function newId(): string {
  return `acct-${Date.now().toString(36)}`;
}

export default function AccountsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AccountCategory>("cash");
  const [notes, setNotes] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const latest = useMemo(
    () => (data ? latestSnapshot(data) : null),
    [data],
  );

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        const active = json.accounts.filter((a) => !a.archived);
        const snap = latestSnapshot(json);
        const initial: Record<string, string> = {};
        for (const a of active) {
          const prev = snap?.balances[a.id];
          initial[a.id] = prev !== undefined ? String(prev) : "";
        }
        setBalances(initial);
        setMonthlyExpenses(
          snap?.monthlyExpenses !== undefined
            ? String(snap.monthlyExpenses)
            : "",
        );
      });
  }, []);

  async function save(next: FinanceData, successMsg?: string) {
    setSaving(true);
    setMessage("");
    const result = await persistFinanceData(next);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error);
      return false;
    }
    setData(result.data);
    if (successMsg) setMessage(successMsg);
    return true;
  }

  async function onSaveBalances(e: FormEvent) {
    e.preventDefault();
    if (!data) return;

    const parsed: Record<string, number> = {};
    for (const a of data.accounts.filter((x) => !x.archived)) {
      const raw = balances[a.id]?.trim();
      if (!raw) continue;
      const n = Number(raw.replace(/,/g, ""));
      if (Number.isNaN(n)) {
        setMessage(`Invalid amount for ${a.name}`);
        return;
      }
      parsed[a.id] = n;
    }

    let next = upsertLatestBalances(data, parsed);
    const snap = latestSnapshot(next);
    if (snap) {
      const expenses = monthlyExpenses.trim()
        ? Number(monthlyExpenses.replace(/,/g, ""))
        : undefined;
      const snapshots = next.snapshots.map((s) =>
        s.id === snap.id
          ? { ...s, monthlyExpenses: expenses }
          : s,
      );
      next = { ...next, snapshots };
    }

    await save(
      next,
      `Balances saved to snapshot ${latestSnapshot(next)?.date ?? "today"}.`,
    );
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!data || !name.trim()) return;
    const account: Account = {
      id: newId(),
      name: name.trim(),
      category,
      notes: notes.trim() || undefined,
      isLiability: category === "liability",
    };
    const ok = await save(
      { ...data, accounts: [...data.accounts, account] },
      `Added ${account.name}. Enter a balance below.`,
    );
    if (ok) {
      setBalances((b) => ({ ...b, [account.id]: "" }));
      setName("");
      setNotes("");
      setCategory("cash");
    }
  }

  async function archive(id: string) {
    if (!data) return;
    const accounts = data.accounts.map((a) =>
      a.id === id ? { ...a, archived: true } : a,
    );
    await save({ ...data, accounts });
  }

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;

  const active = data.accounts.filter((a) => !a.archived);
  const archived = data.accounts.filter((a) => a.archived);
  const byCategory = active.reduce(
    (acc, a) => {
      (acc[a.category] ??= []).push(a);
      return acc;
    },
    {} as Record<string, Account[]>,
  );

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Accounts</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enter balances for DBS, Endowus, CPF, etc. Saves to your latest snapshot.
          Income for projections is in{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>

      <form
        onSubmit={onSaveBalances}
        className="space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-primary">Current balances</h3>
          {latest ? (
            <span className="text-xs text-muted">Snapshot: {latest.date}</span>
          ) : (
            <span className="text-xs text-muted">Creates first snapshot</span>
          )}
        </div>

        {active.length === 0 ? (
          <p className="text-sm text-secondary">
            Add accounts below, then enter amounts.
          </p>
        ) : (
          Object.entries(byCategory).map(([cat, list]) => (
            <fieldset key={cat} className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
                {CATEGORY_LABELS[cat as AccountCategory]}
              </legend>
              {list.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-zinc-300">
                    {a.name}
                    {a.isLiability ? (
                      <span className="ml-1 text-xs text-muted">(owed)</span>
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
            </fieldset>
          ))
        )}

        <label className="block text-sm">
          <span className="text-zinc-400">Monthly expenses (SGD)</span>
          <input
            type="text"
            inputMode="decimal"
            className="mt-1 w-full font-mono"
            placeholder="4300"
            value={monthlyExpenses}
            onChange={(e) => setMonthlyExpenses(e.target.value)}
          />
          <span className="mt-0.5 block text-xs text-muted">
            Used with income in Settings for savings &amp; projections
          </span>
        </label>

        <button
          type="submit"
          disabled={saving || active.length === 0}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save balances"}
        </button>
      </form>

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

      <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface-raised">
        {active.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-zinc-200">{a.name}</p>
              <p className="text-xs text-zinc-500">
                {CATEGORY_LABELS[a.category]}
                {a.notes ? ` · ${a.notes}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => archive(a.id)}
              disabled={saving}
              className="text-xs text-zinc-500 hover:text-negative"
            >
              Archive
            </button>
          </li>
        ))}
      </ul>

      {archived.length > 0 ? (
        <p className="text-xs text-zinc-600">
          {archived.length} archived account(s) hidden.
        </p>
      ) : null}

      <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <p className="text-xs font-medium text-muted">Quick add (Singapore)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SG_ACCOUNT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!data) return;
                if (
                  data.accounts.some(
                    (a) => !a.archived && a.name === preset.name,
                  )
                ) {
                  setMessage(`${preset.name} already exists.`);
                  return;
                }
                const account: Account = {
                  id: `acct-${Date.now().toString(36)}`,
                  name: preset.name,
                  category: preset.category,
                  notes: preset.notes,
                  isLiability: preset.isLiability,
                };
                const ok = await save(
                  { ...data, accounts: [...data.accounts, account] },
                );
                if (ok) {
                  setBalances((b) => ({ ...b, [account.id]: "" }));
                }
              }}
              className="rounded-full border border-surface-border px-3 py-1 text-xs text-secondary hover:border-accent hover:text-accent"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={onAdd}
        className="space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4"
      >
        <h3 className="text-sm font-medium text-primary">Add account</h3>
        <label className="block text-sm">
          <span className="text-zinc-400">Name</span>
          <input
            className="mt-1 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CPF SA / SRS / Brokerage"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Category</span>
          <select
            className="mt-1 w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value as AccountCategory)}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Notes (optional)</span>
          <input
            className="mt-1 w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted"
        >
          Add
        </button>
      </form>
    </div>
  );
}
