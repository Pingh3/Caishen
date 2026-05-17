"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatPercent, formatUsd } from "@/lib/finance";
import { normalizeSymbol } from "@/lib/market";
import {
  TRADE_CATEGORY_LABELS,
  computeJournalStats,
  holdingsFromOpenTrades,
  isTradeOpen,
  tradeCostNative,
  tradeDaysHeld,
  tradePnlSgd,
} from "@/lib/trades";
import type {
  FinanceData,
  QuoteResult,
  StockMarket,
  Trade,
  TradeCategory,
} from "@/lib/types";

type Filter = "all" | "open" | "closed" | "stocks" | "others";

function newId(): string {
  return `tr-${Date.now().toString(36)}`;
}

function parseNum(s: string): number {
  return Number(s.replace(/,/g, ""));
}

export default function JournalPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [usdToSgd, setUsdToSgd] = useState(1.35);
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const [detecting, setDetecting] = useState(false);

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [exitDate, setExitDate] = useState("");
  const [category, setCategory] = useState<TradeCategory>("stocks");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [market, setMarket] = useState<StockMarket | null>(null);
  const [quantity, setQuantity] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [fees, setFees] = useState("");
  const [dividendIncome, setDividendIncome] = useState("");
  const [ideaSource, setIdeaSource] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");

  const trades = useMemo(() => data?.trades ?? [], [data?.trades]);

  const refreshQuotes = useCallback(async (list: Trade[]) => {
    const openStocks = list.filter(
      (t) => isTradeOpen(t) && t.category === "stocks",
    );
    if (openStocks.length === 0) {
      setQuotes([]);
      return;
    }
    const holdings = holdingsFromOpenTrades(openStocks);
    const res = await fetch("/api/market/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings }),
    });
    const json = (await res.json()) as { quotes: QuoteResult[]; usdToSgd: number };
    setQuotes(json.quotes);
    setUsdToSgd(json.usdToSgd);
  }, []);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((json: FinanceData) => {
        setData(json);
        if (json.trades?.length) refreshQuotes(json.trades);
      });
  }, [refreshQuotes]);

  const quoteMap = useMemo(
    () => new Map(quotes.map((q) => [`${q.market}:${q.symbol}`, q])),
    [quotes],
  );

  const stats = useMemo(
    () => computeJournalStats(trades, quoteMap, usdToSgd),
    [trades, quoteMap, usdToSgd],
  );

  const filtered = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
    );
    return sorted.filter((t) => {
      if (filter === "open") return isTradeOpen(t);
      if (filter === "closed") return !isTradeOpen(t);
      if (filter === "stocks") return t.category === "stocks";
      if (filter === "others") return t.category !== "stocks";
      return true;
    });
  }, [trades, filter]);

  async function saveData(next: FinanceData) {
    const res = await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      setMessage("Failed to save.");
      return false;
    }
    setData(next);
    await refreshQuotes(next.trades ?? []);
    return true;
  }

  async function detectSymbol(raw: string) {
    if (category !== "stocks" || !raw.trim()) return;
    setDetecting(true);
    try {
      const res = await fetch(
        `/api/market/detect?symbol=${encodeURIComponent(raw.trim())}`,
      );
      const json = await res.json();
      if (res.ok) {
        setMarket(json.market);
        setSymbol(normalizeSymbol(raw));
        setUsdToSgd(json.usdToSgd ?? usdToSgd);
      }
    } finally {
      setDetecting(false);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!data || !symbol.trim()) return;
    const qty = parseNum(quantity);
    const entry = parseNum(entryPrice);
    if (Number.isNaN(qty) || qty <= 0 || Number.isNaN(entry) || entry <= 0) {
      setMessage("Quantity and entry price are required.");
      return;
    }
    const resolvedMarket =
      market ?? (category === "stocks" ? null : "SG");
    if (category === "stocks" && !resolvedMarket) {
      setMessage("Detect market for stocks (tab out of symbol field).");
      return;
    }

    const trade: Trade = {
      id: newId(),
      entryDate,
      exitDate: exitDate || undefined,
      market: resolvedMarket as StockMarket,
      category,
      symbol: category === "stocks" ? normalizeSymbol(symbol) : symbol.trim(),
      description: description.trim() || undefined,
      quantity: qty,
      entryPrice: entry,
      exitPrice: exitPrice ? parseNum(exitPrice) : undefined,
      fees: fees ? parseNum(fees) : undefined,
      dividendIncome: dividendIncome ? parseNum(dividendIncome) : undefined,
      linkedAccountId: linkedAccountId || undefined,
      ideaSource: ideaSource.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const ok = await saveData({ ...data, trades: [...trades, trade] });
    if (!ok) return;
    setSymbol("");
    setDescription("");
    setQuantity("");
    setEntryPrice("");
    setExitPrice("");
    setFees("");
    setDividendIncome("");
    setIdeaSource("");
    setNotes("");
    setMarket(null);
    setMessage("Trade logged.");
  }

  async function removeTrade(id: string) {
    if (!data) return;
    await saveData({ ...data, trades: trades.filter((t) => t.id !== id) });
  }

  async function syncToInvestments() {
    if (!data) return;
    const derived = holdingsFromOpenTrades(trades);
    const manual = (data.holdings ?? []).filter(
      (h) => !h.id.startsWith("from-trade-"),
    );
    await saveData({ ...data, holdings: [...manual, ...derived] });
    setMessage(
      `Synced ${derived.length} open stock position(s) to Investments. Review live prices there.`,
    );
  }

  const brokerageAccounts =
    data?.accounts.filter(
      (a) => !a.archived && a.category === "investments",
    ) ?? [];

  const entryLabel =
    market === "US" ? "Entry (USD)" : market === "SG" ? "Entry (SGD)" : "Entry price";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Trading journal</h2>
          <p className="text-sm text-secondary">
            Log entries once — open positions sync to{" "}
            <Link href="/investments" className="text-accent hover:underline">
              Investments
            </Link>{" "}
            for live prices.
          </p>
        </div>
        <button
          type="button"
          onClick={syncToInvestments}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Sync open stocks → Investments
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Realised P&amp;L</p>
          <p
            className={`font-mono text-xl font-semibold tabular-nums ${
              stats.realizedPnlSgd >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {formatCurrency(stats.realizedPnlSgd)}
          </p>
          <p className="text-xs text-muted">{stats.closedCount} closed trades</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Open unrealised</p>
          <p
            className={`font-mono text-xl font-semibold tabular-nums ${
              stats.openUnrealizedSgd >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {formatCurrency(stats.openUnrealizedSgd)}
          </p>
          <p className="text-xs text-muted">
            {stats.openCount} open · {formatCurrency(stats.openCostSgd)} cost
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Win rate</p>
          <p className="font-mono text-xl font-semibold text-primary">
            {stats.winRate !== null ? formatPercent(stats.winRate) : "—"}
          </p>
          <p className="text-xs text-muted">Closed trades only</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Avg win / loss</p>
          <p className="font-mono text-sm font-semibold text-positive">
            {stats.avgWinPct !== null
              ? formatPercent(stats.avgWinPct, true)
              : "—"}
          </p>
          <p className="font-mono text-sm font-semibold text-negative">
            {stats.avgLossPct !== null
              ? formatPercent(stats.avgLossPct)
              : "—"}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["open", "Open"],
            ["closed", "Closed"],
            ["stocks", "Stocks"],
            ["others", "Govt & robo"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === key
                ? "bg-accent/15 text-accent"
                : "text-secondary hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-surface-raised text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-3">Entry</th>
                <th className="px-3 py-3">Exit</th>
                <th className="px-3 py-3">Days</th>
                <th className="px-3 py-3">Ticker</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Entry</th>
                <th className="px-3 py-3 text-right">Last / Exit</th>
                <th className="px-3 py-3 text-right">P&amp;L (SGD)</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const open = isTradeOpen(t);
                const q =
                  t.category === "stocks"
                    ? quoteMap.get(`${t.market}:${t.symbol.toUpperCase()}`)
                    : undefined;
                const mark = open ? q?.price : t.exitPrice;
                const pnl = tradePnlSgd(t, mark, usdToSgd);
                const broker = data?.accounts.find(
                  (a) => a.id === t.linkedAccountId,
                )?.name;
                return (
                  <tr key={t.id} className="border-t border-surface-border">
                    <td className="px-3 py-2.5 text-xs text-secondary">
                      {t.entryDate}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-secondary">
                      {t.exitDate ?? (
                        <span className="text-accent">Open</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                      {tradeDaysHeld(t)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-primary">
                        {t.symbol}
                      </span>
                      <span className="ml-1 text-[10px] text-muted">
                        {t.market}
                      </span>
                      {t.description ? (
                        <p className="text-xs text-muted">{t.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-secondary">
                      {TRADE_CATEGORY_LABELS[t.category]}
                      {broker ? ` · ${broker}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {t.quantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                      {t.market === "US"
                        ? formatUsd(t.entryPrice)
                        : formatCurrency(t.entryPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                      {mark !== undefined
                        ? t.market === "US"
                          ? formatUsd(mark)
                          : formatCurrency(mark)
                        : "—"}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono text-xs tabular-nums ${
                        pnl && pnl.pnlSgd >= 0
                          ? "text-positive"
                          : pnl
                            ? "text-negative"
                            : ""
                      }`}
                    >
                      {pnl
                        ? `${formatCurrency(pnl.pnlSgd)}${
                            pnl.pnlPct !== null
                              ? ` (${formatPercent(pnl.pnlPct, true)})`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeTrade(t.id)}
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
        <p className="text-sm text-muted">No trades in this view yet.</p>
      )}

      <form
        onSubmit={onAdd}
        className="mx-auto max-w-2xl space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4"
      >
        <h3 className="text-sm font-medium text-primary">Log trade</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-secondary">Entry date</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Exit date (if closed)</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Category</span>
            <select
              className="mt-1 w-full"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as TradeCategory);
                if (e.target.value !== "stocks") setMarket("SG");
              }}
            >
              {Object.entries(TRADE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-secondary">Ticker / ID</span>
            <input
              className="mt-1 w-full font-mono uppercase"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setMarket(null);
              }}
              onBlur={(e) => detectSymbol(e.target.value)}
              required
            />
            {detecting ? (
              <p className="mt-1 text-xs text-muted">Detecting…</p>
            ) : market ? (
              <p className="mt-1 text-xs text-positive">
                {market === "SG" ? "SGX · SGD" : "US · USD"}
              </p>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Description</span>
            <input
              className="mt-1 w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="DBS, Wee Hur, T-Bill…"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
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
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Exit / mark price</span>
            <input
              className="mt-1 w-full font-mono"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder={exitDate ? "Required if closed" : "Optional"}
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Fees</span>
            <input
              className="mt-1 w-full font-mono"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-secondary">Dividend / interest income</span>
            <input
              className="mt-1 w-full font-mono"
              value={dividendIncome}
              onChange={(e) => setDividendIncome(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Idea source</span>
            <input
              className="mt-1 w-full"
              value={ideaSource}
              onChange={(e) => setIdeaSource(e.target.value)}
              placeholder="PT Alumni, ASSI, personal…"
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
        ) : null}
        <label className="block text-sm">
          <span className="text-secondary">Notes</span>
          <textarea
            className="mt-1 w-full"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Add to journal
        </button>
      </form>

      {message ? <p className="text-sm text-secondary">{message}</p> : null}
    </div>
  );
}
