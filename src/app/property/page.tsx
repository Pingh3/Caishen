"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/finance";
import type { FinanceData, PropertyProfile, SgHouseType } from "@/lib/types";
import type { PropertyEstimate } from "@/lib/sg-property";

const HOUSE_TYPES: { value: SgHouseType; label: string }[] = [
  { value: "HDB_3RM", label: "HDB 3-room" },
  { value: "HDB_4RM", label: "HDB 4-room" },
  { value: "HDB_5RM", label: "HDB 5-room" },
  { value: "HDB_EXEC", label: "HDB Executive" },
  { value: "CONDO", label: "Condominium" },
  { value: "LANDED", label: "Landed" },
];

export default function PropertyPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [houseType, setHouseType] = useState<SgHouseType>("HDB_4RM");
  const [floorAreaSqm, setFloorAreaSqm] = useState("");
  const [mortgageOutstanding, setMortgageOutstanding] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [estimate, setEstimate] = useState<PropertyEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        const p = json.property;
        if (p) {
          setPostalCode(p.postalCode);
          setHouseType(p.houseType);
          setFloorAreaSqm(p.floorAreaSqm?.toString() ?? "");
          setMortgageOutstanding(p.mortgageOutstanding?.toString() ?? "");
          setManualValue(p.manualValue?.toString() ?? "");
          runEstimate(p);
        }
      });
  }, []);

  async function runEstimate(profile: PropertyProfile) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/property/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, save: true }),
      });
      if (!res.ok) {
        setMessage("Could not estimate. Check postal code.");
        return;
      }
      const json = (await res.json()) as PropertyEstimate;
      setEstimate(json);
      const fin = await fetch("/api/finance").then((r) => r.json());
      setData(fin);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const digits = postalCode.replace(/\D/g, "");
    if (digits.length !== 6) {
      setMessage("Enter a valid 6-digit Singapore postal code.");
      return;
    }
    const profile: PropertyProfile = {
      postalCode: digits,
      houseType,
      floorAreaSqm: floorAreaSqm ? Number(floorAreaSqm) : undefined,
      mortgageOutstanding: mortgageOutstanding
        ? Number(mortgageOutstanding.replace(/,/g, ""))
        : undefined,
      manualValue: manualValue
        ? Number(manualValue.replace(/,/g, ""))
        : undefined,
    };
    await runEstimate(profile);
  }

  async function applyEquityToSnapshot() {
    if (!data || !estimate) return;
    const propertyAccount = data.accounts.find(
      (a) => !a.archived && a.category === "property",
    );
    if (!propertyAccount) {
      setMessage("Add a Property account first (Accounts tab).");
      return;
    }
    const latest = [...data.snapshots].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
    if (!latest) {
      setMessage("Create a snapshot first (Update tab).");
      return;
    }
    const balances = {
      ...latest.balances,
      [propertyAccount.id]: Math.round(estimate.equity),
    };
    const snapshots = data.snapshots.map((s) =>
      s.id === latest.id ? { ...s, balances } : s,
    );
    await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, snapshots }),
    });
    setMessage(
      `Set ${propertyAccount.name} to ${formatCurrency(estimate.equity)} (equity) in latest snapshot.`,
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary">Property estimate</h2>
        <p className="mt-1 text-sm text-secondary">
          HDB flats use recent resale medians from data.gov.sg by town (from your
          postal code). Condos and landed use regional heuristics. Net worth uses{" "}
          <strong className="font-medium text-primary">
            property value minus your mortgage
          </strong>
          . Store <em>net equity</em> on the Property account (or gross value plus
          mortgage on Update) — not both ways at once.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4">
        <label className="block text-sm">
          <span className="text-secondary">Postal code</span>
          <input
            className="mt-1 w-full font-mono"
            placeholder="560123"
            maxLength={6}
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-secondary">House type</span>
          <select
            className="mt-1 w-full"
            value={houseType}
            onChange={(e) => setHouseType(e.target.value as SgHouseType)}
          >
            {HOUSE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-secondary">Floor area (sqm, optional)</span>
          <input
            className="mt-1 w-full font-mono"
            placeholder="93"
            value={floorAreaSqm}
            onChange={(e) => setFloorAreaSqm(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-secondary">Mortgage outstanding (SGD, optional)</span>
          <input
            className="mt-1 w-full font-mono"
            placeholder="350000"
            value={mortgageOutstanding}
            onChange={(e) => setMortgageOutstanding(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-secondary">Manual value override (SGD, optional)</span>
          <input
            className="mt-1 w-full font-mono"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white"
        >
          {loading ? "Estimating…" : "Get estimate"}
        </button>
      </form>

      {estimate ? (
        <section className="space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-muted">Estimated value</p>
              <p className="font-mono text-2xl font-semibold text-primary">
                {formatCurrency(estimate.estimatedValue)}
              </p>
              <p className="text-xs text-secondary">
                {estimate.town} · {estimate.source === "hdb_data" ? "HDB resale data" : "Heuristic"}
                {estimate.sampleCount
                  ? ` · ${estimate.sampleCount} recent transactions`
                  : ""}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">Equity</p>
              <p className="font-mono text-2xl font-semibold text-positive">
                {formatCurrency(estimate.equity)}
              </p>
              <p className="text-xs text-secondary">
                After mortgage {formatCurrency(estimate.mortgageOutstanding)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted">{estimate.disclaimer}</p>
          <button
            type="button"
            onClick={applyEquityToSnapshot}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm text-secondary hover:text-primary"
          >
            Apply equity to latest snapshot
          </button>
        </section>
      ) : null}

      {message ? <p className="text-sm text-secondary">{message}</p> : null}
    </div>
  );
}
