"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { persistFinanceData } from "@/lib/client-finance";
import { formatCurrency, insuranceTotal } from "@/lib/finance";
import type {
  FinanceData,
  InsurancePolicy,
  InsurancePolicyType,
} from "@/lib/types";

const POLICY_TYPES: { value: InsurancePolicyType; label: string }[] = [
  { value: "whole_life", label: "Whole life" },
  { value: "ilp", label: "Investment-linked (ILP)" },
  { value: "endowment", label: "Endowment / savings" },
  { value: "term", label: "Term (no cash value)" },
  { value: "hospitalisation", label: "Hospitalisation / shield" },
  { value: "other", label: "Other" },
];

function policyTypeLabel(t: InsurancePolicyType): string {
  return POLICY_TYPES.find((p) => p.value === t)?.label ?? t;
}

function newId(): string {
  return `ins-${Date.now().toString(36)}`;
}

const emptyForm = {
  insurer: "",
  planName: "",
  policyType: "whole_life" as InsurancePolicyType,
  surrenderValue: "",
  sumAssured: "",
  annualPremium: "",
  maturityDate: "",
  notes: "",
};

export default function InsurancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const policies = useMemo(
    () => (data?.insurancePolicies ?? []).filter((p) => !p.archived),
    [data?.insurancePolicies],
  );

  const totalSurrender = useMemo(() => insuranceTotal(policies), [policies]);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then(setData);
  }, []);

  function loadPolicy(p: InsurancePolicy) {
    setEditingId(p.id);
    setForm({
      insurer: p.insurer,
      planName: p.planName,
      policyType: p.policyType,
      surrenderValue: String(p.surrenderValue),
      sumAssured: p.sumAssured !== undefined ? String(p.sumAssured) : "",
      annualPremium:
        p.annualPremium !== undefined ? String(p.annualPremium) : "",
      maturityDate: p.maturityDate ?? "",
      notes: p.notes ?? "",
    });
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data || !form.insurer.trim() || !form.planName.trim()) return;

    const surrender = Number(form.surrenderValue.replace(/,/g, ""));
    if (Number.isNaN(surrender) || surrender < 0) {
      setMessage("Enter a valid surrender / cash value.");
      return;
    }

    const policy: InsurancePolicy = {
      id: editingId ?? newId(),
      insurer: form.insurer.trim(),
      planName: form.planName.trim(),
      policyType: form.policyType,
      surrenderValue: surrender,
      sumAssured: form.sumAssured
        ? Number(form.sumAssured.replace(/,/g, ""))
        : undefined,
      annualPremium: form.annualPremium
        ? Number(form.annualPremium.replace(/,/g, ""))
        : undefined,
      maturityDate: form.maturityDate.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    const others = (data.insurancePolicies ?? []).filter(
      (p) => p.id !== policy.id,
    );
    const next = {
      ...data,
      insurancePolicies: editingId
        ? [...others, policy]
        : [...(data.insurancePolicies ?? []), policy],
    };

    setSaving(true);
    const result = await persistFinanceData(next);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setData(result.data);
    setMessage(editingId ? "Policy updated." : "Policy added.");
    clearForm();
  }

  async function archivePolicy(id: string) {
    if (!data) return;
    if (!window.confirm("Archive this policy?")) return;
    const next = {
      ...data,
      insurancePolicies: (data.insurancePolicies ?? []).map((p) =>
        p.id === id ? { ...p, archived: true } : p,
      ),
    };
    setSaving(true);
    const result = await persistFinanceData(next);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setData(result.data);
    if (editingId === id) clearForm();
    setMessage("Policy archived.");
  }

  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary">Insurance</h2>
        <p className="mt-1 text-sm text-secondary">
          Track surrender and cash values for whole-life, ILP, and endowment
          policies. Included in{" "}
          <Link href="/" className="text-accent hover:underline">
            total net worth
          </Link>
          . Term and shield plans can be listed at $0 cash value for reference.
        </p>
        <p className="mt-2 font-mono text-xl font-semibold text-primary">
          {formatCurrency(totalSurrender)}
          <span className="ml-2 text-sm font-normal text-muted">
            total surrender value
          </span>
        </p>
      </div>

      {message ? (
        <p className="text-sm text-secondary">{message}</p>
      ) : null}

      {policies.length > 0 ? (
        <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface-raised">
          {policies.map((p) => (
            <li key={p.id} className="px-4 py-4 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-primary">
                    {p.insurer} — {p.planName}
                  </p>
                  <p className="text-xs text-muted">
                    {policyTypeLabel(p.policyType)}
                    {p.maturityDate ? ` · matures ${p.maturityDate}` : ""}
                  </p>
                  {p.sumAssured ? (
                    <p className="mt-1 text-xs text-secondary">
                      Sum assured {formatCurrency(p.sumAssured)}
                      {p.annualPremium
                        ? ` · premium ${formatCurrency(p.annualPremium)}/yr`
                        : ""}
                    </p>
                  ) : null}
                  {p.notes ? (
                    <p className="mt-1 text-xs text-muted">{p.notes}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold text-primary">
                    {formatCurrency(p.surrenderValue)}
                  </p>
                  <p className="text-[10px] uppercase text-muted">
                    Surrender value
                  </p>
                  <div className="mt-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => loadPolicy(p)}
                      className="text-xs text-accent hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => archivePolicy(p.id)}
                      className="text-xs text-muted hover:text-negative"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-secondary">
          No policies yet. Add your first plan below.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4"
      >
        <h3 className="text-sm font-medium text-primary">
          {editingId ? "Edit policy" : "Add policy"}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-secondary">Insurer</span>
            <input
              className="mt-1 w-full"
              placeholder="AIA, Prudential, Great Eastern…"
              value={form.insurer}
              onChange={(e) =>
                setForm((f) => ({ ...f, insurer: e.target.value }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Plan name</span>
            <input
              className="mt-1 w-full"
              placeholder="e.g. Max Wealth Advantage"
              value={form.planName}
              onChange={(e) =>
                setForm((f) => ({ ...f, planName: e.target.value }))
              }
              required
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-secondary">Policy type</span>
          <select
            className="mt-1 w-full"
            value={form.policyType}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                policyType: e.target.value as InsurancePolicyType,
              }))
            }
          >
            {POLICY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-secondary">Surrender / cash value (SGD)</span>
            <input
              className="mt-1 w-full font-mono"
              inputMode="decimal"
              placeholder="0"
              value={form.surrenderValue}
              onChange={(e) =>
                setForm((f) => ({ ...f, surrenderValue: e.target.value }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Sum assured (optional)</span>
            <input
              className="mt-1 w-full font-mono"
              value={form.sumAssured}
              onChange={(e) =>
                setForm((f) => ({ ...f, sumAssured: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Annual premium (optional)</span>
            <input
              className="mt-1 w-full font-mono"
              value={form.annualPremium}
              onChange={(e) =>
                setForm((f) => ({ ...f, annualPremium: e.target.value }))
              }
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-secondary">Maturity date (optional)</span>
          <input
            type="date"
            className="mt-1 w-full"
            value={form.maturityDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, maturityDate: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-secondary">Notes</span>
          <textarea
            className="mt-1 w-full"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Add policy"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={clearForm}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-secondary"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
