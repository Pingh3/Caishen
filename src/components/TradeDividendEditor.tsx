"use client";

import { useState } from "react";
import { useAmountFormatters } from "@/components/PrivacyProvider";
import {
  buildDividendPayment,
  netDividendFromGross,
  syncTradeDividendTotals,
} from "@/lib/dividends";
import type { DividendPayment, StockMarket, Trade } from "@/lib/types";

type Props = {
  market: StockMarket;
  quantity: number;
  entryDate: string;
  exitDate: string;
  symbol: string;
  category: string;
  payments: DividendPayment[];
  onChange: (payments: DividendPayment[]) => void;
};

const emptyRow = {
  paymentDate: "",
  grossTotal: "",
  grossPerShare: "",
};

export function TradeDividendEditor({
  market,
  quantity,
  entryDate,
  exitDate,
  symbol,
  category,
  payments,
  onChange,
}: Props) {
  const display = useAmountFormatters();
  const [row, setRow] = useState(emptyRow);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (category !== "stocks" || quantity <= 0) return null;

  const fmt = (n: number) => display.tradePrice(n, market);
  const totals = syncTradeDividendTotals(
    { market, quantity } as Trade,
    payments,
  );

  function addPayment() {
    const built = buildDividendPayment(
      { market, quantity },
      {
        paymentDate: row.paymentDate,
        grossTotal: row.grossTotal.trim()
          ? Number(row.grossTotal.replace(/,/g, ""))
          : undefined,
        grossPerShare: row.grossPerShare.trim()
          ? Number(row.grossPerShare.replace(/,/g, ""))
          : undefined,
        source: "manual",
      },
    );
    if (typeof built === "string") {
      setMsg(built);
      return;
    }
    onChange([...payments, built]);
    setRow(emptyRow);
    setMsg("Payment added.");
  }

  async function loadYahooSuggestions() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/journal/dividends/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "suggest",
          symbol,
          market,
          quantity,
          entryDate,
          exitDate: exitDate.trim() || undefined,
          category: "stocks",
          entryPrice: 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "Could not load suggestions.");
        return;
      }
      const suggestions = (json.suggestions ?? []) as DividendPayment[];
      if (suggestions.length === 0) {
        setMsg("No ex-dates in your holding window on Yahoo. Add payments manually.");
        return;
      }
      onChange(suggestions);
      setMsg(
        `${suggestions.length} suggestion(s) loaded. Edit payment dates and amounts to match your broker.`,
      );
    } catch {
      setMsg("Could not load suggestions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-surface-border bg-surface-raised/50 p-3">
      <div>
        <p className="text-sm font-medium text-primary">Dividend payments</p>
        <p className="mt-1 text-xs text-secondary">
          {market === "US"
            ? "US: enter each cash payment from your broker. Gross is taxed at 30% to net (e.g. $61.41 gross → $42.99 net)."
            : "SG/HK: no withholding — cash received equals the dividend amount. Use Fill dividends (SG) for Yahoo ex-dates."}
        </p>
      </div>

      {payments.length > 0 ? (
        <ul className="space-y-2 text-xs">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-surface-border px-2 py-2"
            >
              <div>
                <p className="font-medium text-primary">
                  Paid {p.paymentDate}
                  {p.exDate && p.exDate !== p.paymentDate
                    ? ` (ex ${p.exDate})`
                    : ""}
                </p>
                <p className="font-mono text-secondary">
                  {market === "US" ? (
                    <>
                      {fmt(p.grossPerShare)}/sh x {quantity.toLocaleString()} ={" "}
                      {fmt(p.grossTotal)} gross
                    </>
                  ) : (
                    <>
                      {fmt(p.grossPerShare)}/sh x {quantity.toLocaleString()} ={" "}
                      {fmt(p.grossTotal)}
                    </>
                  )}
                </p>
                {market === "US" ? (
                  <p className="font-mono text-positive">
                    Net {fmt(p.netTotal)}
                    {p.source === "yahoo" ? (
                      <span className="text-muted"> · check vs broker</span>
                    ) : null}
                  </p>
                ) : p.source === "yahoo" ? (
                  <p className="text-muted">Check vs broker</p>
                ) : null}
              </div>
              <button
                type="button"
                className="text-muted hover:text-negative"
                onClick={() => onChange(payments.filter((x) => x.id !== p.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {payments.length > 0 ? (
        <p className="font-mono text-sm text-primary">
          Total{" "}
          {market === "US" ? "net " : ""}
          {fmt(totals.dividendIncome ?? 0)}
          {market === "US" && totals.dividendGross !== undefined
            ? ` (${fmt(totals.dividendGross)} gross)`
            : ""}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="text-secondary">Cash payment date</span>
          <input
            type="date"
            className="mt-1 w-full"
            value={row.paymentDate}
            onChange={(e) =>
              setRow((r) => ({ ...r, paymentDate: e.target.value }))
            }
          />
        </label>
        <label className="block text-xs">
          <span className="text-secondary">Gross total ({market})</span>
          <input
            className="mt-1 w-full font-mono"
            placeholder="61.41"
            value={row.grossTotal}
            onChange={(e) =>
              setRow((r) => ({ ...r, grossTotal: e.target.value }))
            }
          />
        </label>
        <label className="block text-xs">
          <span className="text-secondary">or gross / share</span>
          <input
            className="mt-1 w-full font-mono"
            placeholder="0.89"
            value={row.grossPerShare}
            onChange={(e) =>
              setRow((r) => ({ ...r, grossPerShare: e.target.value }))
            }
          />
        </label>
      </div>

      {row.grossTotal.trim() && market === "US" ? (
        <p className="text-xs text-positive">
          Net preview:{" "}
          {fmt(
            netDividendFromGross(
              "US",
              Number(row.grossTotal.replace(/,/g, "")) || 0,
            ),
          )}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addPayment}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-secondary hover:text-primary"
        >
          Add payment
        </button>
        {market !== "US" ? (
          <button
            type="button"
            disabled={loading}
            onClick={loadYahooSuggestions}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load Yahoo hints"}
          </button>
        ) : null}
      </div>

      {msg ? <p className="text-xs text-secondary">{msg}</p> : null}
    </div>
  );
}
