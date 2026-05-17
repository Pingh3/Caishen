"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatUsd } from "@/lib/finance";
import { holdingValueSgd } from "@/lib/market";
import type { FinanceData, Holding, QuoteResult, StockMarket } from "@/lib/types";

function newId(): string {
  return `h-${Date.now().toString(36)}`;
}

export default function InvestmentsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [usdToSgd, setUsdToSgd] = useState(1.35);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [market, setMarket] = useState<StockMarket>("US");
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
    await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setData(next);
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!data || !symbol.trim() || !quantity.trim()) return;
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      setMessage("Enter a valid quantity");
      return;
    }
    const holding: Holding = {
      id: newId(),
      symbol: symbol.trim().toUpperCase(),
      quantity: qty,
      market,
      linkedAccountId: linkedAccountId || undefined,
    };
    const next = { ...data, holdings: [...holdings, holding] };
    await saveData(next);
    setSymbol("");
    setQuantity("");
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
        : `Portfolio total ${formatCurrency(totalSgd)} — link holdings to accounts to sync.`,
    );
  }

  const quoteMap = new Map(
    quotes.map((q) => [`${q.market}:${q.symbol}`, q]),
  );
  const totalSgd = holdings.reduce((sum, h) => {
    const q = quoteMap.get(`${h.market}:${h.symbol.toUpperCase()}`);
    return sum + holdingValueSgd(h, q);
  }, 0);

  const brokerageAccounts =
    data?.accounts.filter(
      (a) => !a.archived && a.category === "investments",
    ) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Live investments</h2>
          <p className="text-sm text-secondary">
            US prices in USD, converted at {usdToSgd.toFixed(4)} USD/SGD. SG
            stocks in SGD. Refreshes every minute.
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

      {lastRefresh ? (
        <p className="text-xs text-muted">
          Last updated{" "}
          {lastRefresh.toLocaleTimeString("en-SG", {
            timeZone: "Asia/Singapore",
          })}{" "}
          (SGT)
        </p>
      ) : null}

      <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase text-muted">Portfolio (SGD)</p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-primary">
          {formatCurrency(totalSgd)}
        </p>
      </div>

      {holdings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-raised text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Value (SGD)</th>
                <th className="px-4 py-3 text-right">Day %</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const q = quoteMap.get(`${h.market}:${h.symbol.toUpperCase()}`);
                const val = holdingValueSgd(h, q);
                const ch = q?.changePercent;
                return (
                  <tr key={h.id} className="border-t border-surface-border">
                    <td className="px-4 py-3">
                      <span className="font-medium text-primary">{h.symbol}</span>
                      <span className="ml-2 text-xs text-muted">{h.market}</span>
                      {q?.name ? (
                        <p className="text-xs text-muted">{q.name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {h.quantity}
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
                      {formatCurrency(val)}
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
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-1">
            <span className="text-secondary">Symbol</span>
            <input
              className="mt-1 w-full font-mono uppercase"
              placeholder="AAPL / D05"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              required
            />
          </label>
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
            <span className="text-secondary">Market</span>
            <select
              className="mt-1 w-full"
              value={market}
              onChange={(e) => setMarket(e.target.value as StockMarket)}
            >
              <option value="US">US (USD → SGD)</option>
              <option value="SG">Singapore (SGD)</option>
            </select>
          </label>
        </div>
        {brokerageAccounts.length > 0 ? (
          <label className="block text-sm">
            <span className="text-secondary">Link to brokerage account (optional)</span>
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
        ) : null}
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Add holding
        </button>
      </form>

      {message ? <p className="text-sm text-secondary">{message}</p> : null}
    </div>
  );
}
