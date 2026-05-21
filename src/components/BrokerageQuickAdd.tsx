"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  BROKERAGE_PRESETS,
  createBrokerageAccount,
  listBrokerageAccounts,
} from "@/lib/brokerages";
import type { Account, FinanceData } from "@/lib/types";

type Props = {
  data: FinanceData;
  onSave: (next: FinanceData) => Promise<boolean>;
  onAdded?: (account: Account) => void;
  /** Show link to Accounts tab */
  showAccountsLink?: boolean;
  compact?: boolean;
};

export function BrokerageQuickAdd({
  data,
  onSave,
  onAdded,
  showAccountsLink = true,
  compact = false,
}: Props) {
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [localMsg, setLocalMsg] = useState("");

  const existing = listBrokerageAccounts(data.accounts);

  async function addAccount(name: string, notes?: string) {
    if (existing.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      setLocalMsg(`${name} is already in your accounts.`);
      return;
    }
    const account = createBrokerageAccount(name, notes);
    setSaving(true);
    setLocalMsg("");
    const ok = await onSave({
      ...data,
      accounts: [...data.accounts, account],
    });
    setSaving(false);
    if (ok) {
      setCustomName("");
      onAdded?.(account);
      setLocalMsg(`Added ${account.name}.`);
    }
  }

  async function onCustomSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customName.trim()) return;
    await addAccount(customName.trim());
  }

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-xl border border-surface-border bg-surface-raised p-4"
      }
    >
      {!compact ? (
        <p className="text-xs font-medium text-muted">Add brokerage</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {BROKERAGE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            disabled={saving}
            onClick={() => addAccount(preset.name, preset.notes)}
            className="rounded-full border border-surface-border px-3 py-1 text-xs text-secondary hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {preset.name}
          </button>
        ))}
      </div>
      <form
        onSubmit={onCustomSubmit}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="min-w-[140px] flex-1 text-sm">
          {!compact ? (
            <span className="text-secondary">Other brokerage</span>
          ) : null}
          <input
            className="mt-1 w-full"
            placeholder="e.g. POEMS, FSMOne"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !customName.trim()}
          className="rounded-lg border border-surface-border px-3 py-2 text-xs text-secondary hover:text-primary disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {localMsg ? (
        <p className="text-xs text-secondary">{localMsg}</p>
      ) : null}
      {showAccountsLink ? (
        <p className="text-xs text-muted">
          Brokerages are investment accounts. Set balances on{" "}
          <Link href="/accounts" className="text-accent hover:underline">
            Accounts
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
