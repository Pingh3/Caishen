"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatPercent, formatUsd } from "@/lib/finance";
import { holdingPnl, holdingValueSgd, normalizeSymbol } from "@/lib/market";
import type { FinanceData, Holding, QuoteResult, StockMarket } from "@/lib/types";

function newId(): string {
  return `h-${Date.now().toString(36)}`;
}

function accountName(data: FinanceData, id?: string): string | null {
  if (!id) return null;
  return data.accounts.find((a) => a.id === id)?.name ?? null;
}

export default function InvestmentsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [usdToSgd, setUsdToSgd] = useState(1.35);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [market, setMarket] = useState<StockMarket | null>(null);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [message, setMessage] = useState("");

  const holdings = useMemo(() => data?.holdings ?? [], [data?.holdings]);

  const refreshQuotes = useCallback(async (list: Holding[]) => {
    if (list.length === 0) {
      setQuotes([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/market/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: list }),
      });
      const json = (await res.json()) as {
        quotes: QuoteResult[];
        usdToSgd: number;
      };
      setQuotes(json.quotes);
      setUsdToSgd(json.usdToSgd);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  const detectSymbol = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setMarket(null);
      setDetectedName(null);
      return;
    }
    setDetecting(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/market/detect?symbol=${encodeURIComponent(trimmed)}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setMarket(null);
        setDetectedName(null);
        setMessage(json.error ?? "Ticker not found");
        return;
      }
      setMarket(json.market as StockMarket);
      setDetectedName(json.quote?.name ?? null);
      setUsdToSgd(json.usdToSgd ?? usdToSgd);
      setSymbol(normalizeSymbol(trimmed));
    } catch {
      setMessage("Could not detect market. Check your connection.");
    } finally {
      setDetecting(false);
    }
  }, [usdToSgd]);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        const h = json.holdings ?? [];
        if (h.length) refreshQuotes(h);
      });
  }, [refreshQuotes]);

  useEffect(() => {
    if (holdings.length === 0) return;
    const id = window.setInterval(() => refreshQuotes(holdings), 60_000);
    return () => window.clearInterval(id);
  }, [holdings, refreshQuotes]);

  async function saveData(next: FinanceData) {
    const res = await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error ?? "Failed to save");
      return false;
    }
    setData(next);
    return true;
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!data || !symbol.trim() || !quantity.trim() || !entryPrice.trim()) {
      setMessage("Symbol, quantity, and entry price are required.");
      return;
    }
    if (!market) {
      setMessage("Wait for market detection (SG/US) or check the symbol.");
      return;
    }
    const qty = Number(quantity);
    const entry = Number(entryPrice.replace(/,/g, ""));
    if (Number.isNaN(qty) || qty <= 0 || Number.isNaN(entry) || entry <= 0) {
      setMessage("Enter valid quantity and entry price.");
      return;
    }

    const holding: Holding = {
      id: newId(),
      symbol: normalizeSymbol(symbol),
      quantity: qty,
      market,
      avgEntryPrice: entry,
      linkedAccountId: linkedAccountId || undefined,
    };
    const next = { ...data, holdings: [...holdings, holding] };
    const ok = await saveData(next);
    if (!ok) return;
    setSymbol("");
    setQuantity("");
    setEntryPrice("");
    setMarket(null);
    setDetectedName(null);
    setLinkedAccountId("");
    setMessage("");
    await refreshQuotes(next.holdings!);
  }

  async function removeHolding(id: string) {
    if (!data) return;
    const nextList = holdings.filter((h) => h.id !== id);
    const next = { ...data, holdings: nextList };
    await saveData(next);
    await refreshQuotes(nextList);
  }

  async function syncToAccount() {
    if (!data) return;
    const bySymbol = new Map(quotes.map((q) => [`${q.market}:${q.symbol}`, q]));
    let totalSgd = 0;
    const byAccount = new Map<string, number>();

    for (const h of holdings) {
      const q = bySymbol.get(`${h.market}:${h.symbol.toUpperCase()}`);
      const val = holdingValueSgd(h, q);
      totalSgd += val;
      if (h.linkedAccountId) {
        byAccount.set(
          h.linkedAccountId,
          (byAccount.get(h.linkedAccountId) ?? 0) + val,
        );
      }
    }

    const latest = [...data.snapshots].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
    if (!latest) {
      setMessage("Create a snapshot first (Update tab).");
      return;
    }

    const balances = { ...latest.balances };
    for (const [acctId, val] of byAccount) {
      balances[acctId] = Math.round(val);
    }

    const snapshots = data.snapshots.map((s) =>
      s.id === latest.id ? { ...s, balances } : s,
    );

    await saveData({ ...data, snapshots });
    setMessage(
      byAccount.size > 0
        ? `Updated ${byAccount.size} linked account(s) in latest snapshot.`
        : `Portfolio total ${formatCurrency(totalSgd)} — link holdings to Moomoo / Syfe / Endowus to sync.`,
    );
  }

  const quoteMap = new Map(
    quotes.map((q) => [`${q.market}:${q.symbol}`, q]),
  );

  let totalValue = 0;
  let totalCost = 0;
  for (const h of holdings) {
    const q = quoteMap.get(`${h.market}:${h.symbol.toUpperCase()}`);
    const { costSgd, valueSgd } = holdingPnl(h, q, usdToSgd);
    totalCost += costSgd;
    totalValue += valueSgd;
  }
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  const brokerageAccounts =
    data?.accounts.filter(
      (a) => !a.archived && a.category === "investments",
    ) ?? [];

  const entryLabel =
    market === "US" ? "Entry price (USD)" : market === "SG" ? "Entry price (SGD)" : "Entry price";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Live investments</h2>
          <p className="text-sm text-secondary">
            Ticker auto-detects SGX vs US. P&amp;L in SGD at {usdToSgd.toFixed(4)}{" "}
            USD/SGD. Log trades in{" "}
            <Link href="/journal" className="text-accent hover:underline">
              Journal
            </Link>{" "}
            first, then sync open positions here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => refreshQuotes(holdings)}
            disabled={loading || holdings.length === 0}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm text-secondary hover:text-primary"
          >
            {loading ? "Refreshing…" : "Refresh now"}
          </button>
          <button
            type="button"
            onClick={syncToAccount}
            disabled={holdings.length === 0}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            Sync to snapshot
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-secondary">
        <p className="font-medium text-primary">Brokerages (Moomoo, Syfe, Endowus)</p>
        <p className="mt-1 leading-relaxed">
          These platforms don&apos;t offer a simple personal API to pull your
          holdings automatically. Link each stock to{" "}
          <strong className="text-primary">Moomoo</strong>,{" "}
          <strong className="text-primary">Syfe</strong>, or{" "}
          <strong className="text-primary">Endowus</strong> below, then use{" "}
          <em>Sync to snapshot</em> to update account balances. For Syfe/Endowus
          portfolio totals without individual tickers, enter the balance manually on
          the Update tab.
        </p>
      </div>

      {lastRefresh ? (
        <p className="text-xs text-muted">
          Last updated{" "}
          {lastRefresh.toLocaleTimeString("en-SG", {
            timeZone: "Asia/Singapore",
          })}{" "}
          (SGT)
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs font-medium uppercase text-muted">Value (SGD)</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-primary">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs font-medium uppercase text-muted">Cost (SGD)</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-primary">
            {formatCurrency(totalCost)}
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs font-medium uppercase text-muted">Unrealised P&amp;L</p>
          <p
            className={`font-mono text-2xl font-semibold tabular-nums ${
              totalPnl >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {formatCurrency(totalPnl)}
            {totalPnlPct !== null ? (
              <span className="ml-2 text-base">
                ({formatPercent(totalPnlPct, true)})
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {holdings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-raised text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Entry</th>
                <th className="px-4 py-3 text-right">Last</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">P&amp;L</th>
                <th className="px-4 py-3 text-right">Day</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const q = quoteMap.get(`${h.market}:${h.symbol.toUpperCase()}`);
                const { pnlSgd, pnlPercent, valueSgd } = holdingPnl(
                  h,
                  q,
                  usdToSgd,
                );
                const ch = q?.changePercent;
                const broker = data ? accountName(data, h.linkedAccountId) : null;
                return (
                  <tr key={h.id} className="border-t border-surface-border">
                    <td className="px-4 py-3">
                      <span className="font-medium text-primary">{h.symbol}</span>
                      <span className="ml-2 rounded bg-surface-border px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {h.market}
                      </span>
                      {q?.name ? (
                        <p className="text-xs text-muted">{q.name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary">
                      {broker ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {h.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {h.market === "US"
                        ? formatUsd(h.avgEntryPrice)
                        : formatCurrency(h.avgEntryPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {q ? (
                        h.market === "US" ? (
                          <>
                            {formatUsd(q.price)}
                            <br />
                            <span className="text-muted">
                              {formatCurrency(q.priceSgd)}
                            </span>
                          </>
                        ) : (
                          formatCurrency(q.price)
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatCurrency(valueSgd)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs tabular-nums ${
                        pnlSgd >= 0 ? "text-positive" : "text-negative"
                      }`}
                    >
                      {formatCurrency(pnlSgd)}
                      {pnlPercent !== null ? (
                        <>
                          <br />
                          {formatPercent(pnlPercent, true)}
                        </>
                      ) : null}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums ${
                        ch !== null && ch !== undefined
                          ? ch >= 0
                            ? "text-positive"
                            : "text-negative"
                          : ""
                      }`}
                    >
                      {ch !== null && ch !== undefined
                        ? `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeHolding(h.id)}
                        className="text-xs text-muted hover:text-negative"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No holdings yet. Add your first below.</p>
      )}

      <form
        onSubmit={onAdd}
        className="mx-auto max-w-xl space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4"
      >
        <h3 className="text-sm font-medium text-primary">Add holding</h3>
        <label className="block text-sm">
          <span className="text-secondary">Symbol</span>
          <input
            className="mt-1 w-full font-mono uppercase"
            placeholder="NVDA, D05, ES3…"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              setMarket(null);
              setDetectedName(null);
            }}
            onBlur={(e) => detectSymbol(e.target.value)}
            required
          />
          {detecting ? (
            <p className="mt-1 text-xs text-muted">Detecting market…</p>
          ) : market ? (
            <p className="mt-1 text-xs text-positive">
              Detected: {market === "SG" ? "Singapore (SGD)" : "US (USD)"}
              {detectedName ? ` · ${detectedName}` : ""}
            </p>
          ) : null}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-secondary">Quantity</span>
            <input
              className="mt-1 w-full font-mono"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">{entryLabel}</span>
            <input
              className="mt-1 w-full font-mono"
              placeholder={market === "US" ? "150.00" : "3.20"}
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              required
            />
          </label>
        </div>
        {brokerageAccounts.length > 0 ? (
          <label className="block text-sm">
            <span className="text-secondary">Brokerage</span>
            <select
              className="mt-1 w-full"
              value={linkedAccountId}
              onChange={(e) => setLinkedAccountId(e.target.value)}
            >
              <option value="">—</option>
              {brokerageAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-muted">
            Add Moomoo / Syfe / Endowus on the Accounts tab (quick-add presets).
          </p>
        )}
        <button
          type="submit"
          disabled={!market || detecting}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Add holding
        </button>
      </form>

      {message ? <p className="text-sm text-secondary">{message}</p> : null}
    </div>
  );
}
