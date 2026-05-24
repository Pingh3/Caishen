"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAmountFormatters } from "@/components/PrivacyProvider";
import { persistFinanceData } from "@/lib/client-finance";
import { personalLoansTotal } from "@/lib/finance";
import type { FinanceData, PersonalLoan } from "@/lib/types";

function newId(): string {
  return `loan-${Date.now().toString(36)}`;
}

const emptyForm = {
  borrowerName: "",
  principalOutstanding: "",
  interestRatePct: "",
  loanDate: "",
  expectedRepaymentDate: "",
  notes: "",
};

export default function LoansPage() {
  const fmt = useAmountFormatters();
  const [data, setData] = useState<FinanceData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loans = useMemo(
    () => (data?.personalLoans ?? []).filter((l) => !l.archived),
    [data?.personalLoans],
  );

  const totalOutstanding = useMemo(() => personalLoansTotal(loans), [loans]);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then(setData);
  }, []);

  function loadLoan(l: PersonalLoan) {
    setEditingId(l.id);
    setForm({
      borrowerName: l.borrowerName,
      principalOutstanding: String(l.principalOutstanding),
      interestRatePct:
        l.interestRatePct !== undefined ? String(l.interestRatePct) : "",
      loanDate: l.loanDate ?? "",
      expectedRepaymentDate: l.expectedRepaymentDate ?? "",
      notes: l.notes ?? "",
    });
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data || !form.borrowerName.trim()) return;

    const principal = Number(form.principalOutstanding.replace(/,/g, ""));
    if (Number.isNaN(principal) || principal < 0) {
      setMessage("Enter a valid outstanding amount.");
      return;
    }

    const rateRaw = form.interestRatePct.trim();
    const interestRatePct = rateRaw
      ? Number(rateRaw.replace(/,/g, ""))
      : undefined;
    if (rateRaw && (interestRatePct === undefined || Number.isNaN(interestRatePct))) {
      setMessage("Enter a valid interest rate or leave blank.");
      return;
    }

    const loan: PersonalLoan = {
      id: editingId ?? newId(),
      borrowerName: form.borrowerName.trim(),
      principalOutstanding: principal,
      interestRatePct,
      loanDate: form.loanDate.trim() || undefined,
      expectedRepaymentDate: form.expectedRepaymentDate.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    const others = (data.personalLoans ?? []).filter((l) => l.id !== loan.id);
    const next = {
      ...data,
      personalLoans: editingId
        ? [...others, loan]
        : [...(data.personalLoans ?? []), loan],
    };

    setSaving(true);
    const result = await persistFinanceData(next);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setData(result.data);
    setMessage(editingId ? "Loan updated." : "Loan added.");
    clearForm();
  }

  async function archiveLoan(id: string) {
    if (!data) return;
    if (!window.confirm("Archive this loan?")) return;
    const next = {
      ...data,
      personalLoans: (data.personalLoans ?? []).map((l) =>
        l.id === id ? { ...l, archived: true } : l,
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
    setMessage("Loan archived.");
  }

  if (!data) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary">Loans to others</h2>
        <p className="mt-1 text-sm text-secondary">
          Track money you have lent to family or friends. Outstanding principal
          is included in{" "}
          <Link href="/" className="text-accent hover:underline">
            total net worth
          </Link>{" "}
          and liquid net worth as an asset.
        </p>
        <p className="mt-2 font-mono text-xl font-semibold text-primary">
          {fmt.currency(totalOutstanding)}
          <span className="ml-2 text-sm font-normal text-muted">
            total outstanding
          </span>
        </p>
      </div>

      {message ? <p className="text-sm text-secondary">{message}</p> : null}

      {loans.length > 0 ? (
        <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface-raised">
          {loans.map((l) => (
            <li key={l.id} className="px-4 py-4 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-primary">{l.borrowerName}</p>
                  {l.loanDate || l.expectedRepaymentDate ? (
                    <p className="text-xs text-muted">
                      {l.loanDate ? `from ${l.loanDate}` : ""}
                      {l.expectedRepaymentDate
                        ? ` · due ${l.expectedRepaymentDate}`
                        : ""}
                    </p>
                  ) : null}
                  {l.interestRatePct !== undefined ? (
                    <p className="mt-1 text-xs text-secondary">
                      {l.interestRatePct}% p.a.
                    </p>
                  ) : null}
                  {l.notes ? (
                    <p className="mt-1 text-xs text-muted">{l.notes}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold text-primary">
                    {fmt.currency(l.principalOutstanding)}
                  </p>
                  <p className="text-[10px] uppercase text-muted">Outstanding</p>
                  <div className="mt-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => loadLoan(l)}
                      className="text-xs text-accent hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveLoan(l.id)}
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
          No loans yet. Add your first loan below.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4"
      >
        <h3 className="text-sm font-medium text-primary">
          {editingId ? "Edit loan" : "Add loan"}
        </h3>
        <label className="block text-sm">
          <span className="text-secondary">Borrower name</span>
          <input
            className="mt-1 w-full"
            placeholder="e.g. Alex"
            value={form.borrowerName}
            onChange={(e) =>
              setForm((f) => ({ ...f, borrowerName: e.target.value }))
            }
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-secondary">Outstanding (SGD)</span>
            <input
              className="mt-1 w-full font-mono"
              inputMode="decimal"
              placeholder="10000"
              value={form.principalOutstanding}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  principalOutstanding: e.target.value,
                }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Interest % p.a. (optional)</span>
            <input
              className="mt-1 w-full font-mono"
              placeholder="0"
              value={form.interestRatePct}
              onChange={(e) =>
                setForm((f) => ({ ...f, interestRatePct: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-secondary">Loan date (optional)</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={form.loanDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, loanDate: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Expected repayment (optional)</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={form.expectedRepaymentDate}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  expectedRepaymentDate: e.target.value,
                }))
              }
            />
          </label>
        </div>
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
            {saving ? "Saving..." : editingId ? "Save changes" : "Add loan"}
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
