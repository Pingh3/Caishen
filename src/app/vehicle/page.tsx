"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { persistFinanceData } from "@/lib/client-finance";
import {
  carLoanOwed,
  formatCurrency,
  latestSnapshot,
  vehicleEquity,
  vehicleValue,
} from "@/lib/finance";
import type { FinanceData, VehicleProfile } from "@/lib/types";

const emptyForm = {
  makeModel: "",
  modelYear: "",
  estimatedValue: "",
  plateNumber: "",
  notes: "",
};

export default function VehiclePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const accounts = useMemo(
    () => (data?.accounts ?? []).filter((a) => !a.archived),
    [data?.accounts],
  );

  const latest = useMemo(
    () => (data ? latestSnapshot(data) : null),
    [data],
  );

  const value = useMemo(
    () => vehicleValue(data?.vehicle),
    [data?.vehicle],
  );

  const loanOwed = useMemo(() => {
    if (!latest) return 0;
    return carLoanOwed(latest, accounts);
  }, [latest, accounts]);

  const equity = useMemo(() => {
    if (!latest) return value;
    return vehicleEquity(data?.vehicle, latest, accounts);
  }, [data?.vehicle, latest, accounts, value]);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        const v = json.vehicle;
        if (v) {
          setForm({
            makeModel: v.makeModel,
            modelYear: v.modelYear?.toString() ?? "",
            estimatedValue: String(v.estimatedValue),
            plateNumber: v.plateNumber ?? "",
            notes: v.notes ?? "",
          });
        }
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data || !form.makeModel.trim()) return;

    const estimated = Number(form.estimatedValue.replace(/,/g, ""));
    if (Number.isNaN(estimated) || estimated < 0) {
      setMessage("Enter a valid estimated value in SGD.");
      return;
    }

    const year = form.modelYear.trim()
      ? Number(form.modelYear)
      : undefined;
    if (year !== undefined && (Number.isNaN(year) || year < 1980 || year > 2100)) {
      setMessage("Enter a valid model year.");
      return;
    }

    const vehicle: VehicleProfile = {
      makeModel: form.makeModel.trim(),
      modelYear: year,
      estimatedValue: estimated,
      plateNumber: form.plateNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      valueAsOf: new Date().toISOString().slice(0, 10),
    };

    setSaving(true);
    const result = await persistFinanceData({ ...data, vehicle });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error ?? "Could not save.");
      return;
    }
    setData(result.data);
    setMessage("Saved.");
  }

  async function onClear() {
    if (!data || !confirm("Remove vehicle from net worth tracking?")) return;
    const next: FinanceData = { ...data };
    delete next.vehicle;
    setSaving(true);
    const result = await persistFinanceData(next);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error ?? "Could not save.");
      return;
    }
    setData(result.data);
    setForm(emptyForm);
    setMessage("Vehicle removed.");
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary">Vehicle</h2>
        <p className="mt-1 text-sm text-muted">
          Track your car&apos;s estimated value in SGD. It counts toward total net
          worth. Update your{" "}
          <Link href="/update" className="text-accent hover:underline">
            Car loan
          </Link>{" "}
          balance on the Update tab (liabilities).
        </p>
      </div>

      {(value > 0 || loanOwed > 0) && latest && (
        <section className="grid gap-3 rounded-xl border border-surface-border bg-surface-raised p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Value</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
              {formatCurrency(value)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Car loan</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-negative">
              {loanOwed > 0 ? formatCurrency(loanOwed) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Net equity</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
              {formatCurrency(equity)}
            </p>
          </div>
        </section>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-surface-border bg-surface-raised p-5"
      >
        <label className="block text-sm">
          <span className="text-muted">Make & model</span>
          <input
            required
            value={form.makeModel}
            onChange={(e) => setForm({ ...form, makeModel: e.target.value })}
            placeholder="e.g. Toyota Camry 2.5"
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-primary"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Model year</span>
            <input
              type="number"
              min={1980}
              max={2100}
              value={form.modelYear}
              onChange={(e) => setForm({ ...form, modelYear: e.target.value })}
              placeholder="2022"
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-primary"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Estimated value (SGD)</span>
            <input
              required
              inputMode="decimal"
              value={form.estimatedValue}
              onChange={(e) =>
                setForm({ ...form, estimatedValue: e.target.value })
              }
              placeholder="85000"
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-primary"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-muted">Plate number (optional)</span>
          <input
            value={form.plateNumber}
            onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-primary"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-primary"
          />
        </label>

        {data?.vehicle?.valueAsOf && (
          <p className="text-xs text-muted">
            Value last updated {data.vehicle.valueAsOf}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {data?.vehicle && (
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-muted hover:text-primary"
            >
              Remove vehicle
            </button>
          )}
        </div>

        {message && (
          <p className="text-sm text-secondary" role="status">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
