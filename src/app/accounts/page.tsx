"use client";

import { FormEvent, useEffect, useState } from "react";
import { CATEGORY_LABELS, CATEGORY_ORDER, SG_ACCOUNT_PRESETS } from "@/lib/finance";
import type { Account, AccountCategory, FinanceData } from "@/lib/types";

function newId(): string {
  return `acct-${Date.now().toString(36)}`;
}

export default function AccountsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AccountCategory>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then(setData);
  }, []);

  async function save(next: FinanceData) {
    setSaving(true);
    await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setData(next);
    setSaving(false);
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
    await save({ ...data, accounts: [...data.accounts, account] });
    setName("");
    setNotes("");
    setCategory("cash");
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

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Accounts</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Define accounts once. Each monthly snapshot only updates balances.
        </p>
      </div>

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
          {archived.length} archived account(s) hidden from updates.
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
                const account: Account = {
                  id: `acct-${Date.now().toString(36)}`,
                  name: preset.name,
                  category: preset.category,
                  notes: preset.notes,
                  isLiability: preset.isLiability,
                };
                await save({ ...data, accounts: [...data.accounts, account] });
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
