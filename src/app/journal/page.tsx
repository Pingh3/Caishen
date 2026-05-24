"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrokerageQuickAdd } from "@/components/BrokerageQuickAdd";
import { TradeDividendEditor } from "@/components/TradeDividendEditor";
import { useAmountFormatters } from "@/components/PrivacyProvider";
import { listBrokerageAccounts } from "@/lib/brokerages";
import { loadFinanceData, persistFinanceData } from "@/lib/client-finance";
import {
  JOURNAL_FILTER_OPTIONS,
  matchesJournalFilter,
  type JournalFilter,
} from "@/lib/journal-filters";
import {
  clearDividendsOnTrades,
  syncTradeDividendTotals,
  tradeDividendSummary,
  tradeHasDividends,
} from "@/lib/dividends";
import { defaultFxRates, normalizeSymbol, type FxRates } from "@/lib/market";
import {
  TRADE_CATEGORY_LABELS,
  computeJournalStats,
  holdingsFromOpenTrades,
  isTradeOpen,
  tradeDaysHeld,
  tradePnlSgd,
  tradeTotalCommission,
} from "@/lib/trades";
import type {
  DividendPayment,
  FinanceData,
  QuoteResult,
  StockMarket,
  Trade,
  TradeCategory,
} from "@/lib/types";

function newId(): string {
  return `tr-${Date.now().toString(36)}`;
}

function parseNum(s: string): number | undefined {
  const t = s.trim().replace(/,/g, "");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  exitDate: "",
  category: "stocks" as TradeCategory,
  symbol: "",
  description: "",
  market: null as StockMarket | null,
  quantity: "",
  entryPrice: "",
  exitPrice: "",
  entryCommission: "",
  exitCommission: "",
  dividendIncome: "",
  ideaSource: "",
  notes: "",
  linkedAccountId: "",
};

export default function JournalPage() {
  const fmt = useAmountFormatters();
  const [data, setData] = useState<FinanceData | null>(null);
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [fx, setFx] = useState<FxRates>(defaultFxRates);
  const [filter, setFilter] = useState<JournalFilter>("all");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "err">("ok");
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");

  const [form, setForm] = useState(emptyForm);
  const [formDividendPayments, setFormDividendPayments] = useState<
    DividendPayment[]
  >([]);

  const trades = useMemo(() => data?.trades ?? [], [data?.trades]);

  const setMsg = (text: string, tone: "ok" | "err" = "ok") => {
    setMessage(text);
    setMessageTone(tone);
  };

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
    if (!res.ok) return;
    const json = (await res.json()) as {
      quotes: QuoteResult[];
      usdToSgd: number;
      hkdToSgd: number;
    };
    setQuotes(json.quotes);
    setFx({ usdToSgd: json.usdToSgd, hkdToSgd: json.hkdToSgd });
  }, []);

  useEffect(() => {
    loadFinanceData()
      .then((json) => {
        setData(json);
        if (json.trades?.length) refreshQuotes(json.trades);
      })
      .catch(() => setMsg("Could not load data.", "err"));
  }, [refreshQuotes]);

  const quoteMap = useMemo(
    () => new Map(quotes.map((q) => [`${q.market}:${q.symbol}`, q])),
    [quotes],
  );

  const stats = useMemo(
    () => computeJournalStats(trades, quoteMap, fx),
    [trades, quoteMap, fx],
  );

  const filtered = useMemo(() => {
    return [...trades]
      .sort(
        (a, b) =>
          new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
      )
      .filter((t) => matchesJournalFilter(t, filter));
  }, [trades, filter]);

  const filterLabel =
    JOURNAL_FILTER_OPTIONS.find((o) => o.key === filter)?.label ?? filter;

  const filteredSgStocks = useMemo(
    () =>
      filtered.filter((t) => t.category === "stocks" && t.market === "SG"),
    [filtered],
  );

  const filteredSgWithDividends = useMemo(
    () => filtered.filter((t) => t.market === "SG" && tradeHasDividends(t)),
    [filtered],
  );

  async function saveData(next: FinanceData): Promise<boolean> {
    setSaving(true);
    const result = await persistFinanceData(next);
    setSaving(false);
    if (!result.ok) {
      setMsg(result.error, "err");
      return false;
    }
    setData(result.data);
    await refreshQuotes(result.data.trades ?? []);
    return true;
  }

  function clearForm() {
    setEditingId(null);
    setForm({ ...emptyForm, entryDate: new Date().toISOString().slice(0, 10) });
    setFormDividendPayments([]);
  }

  function loadTradeToForm(t: Trade) {
    setEditingId(t.id);
    setForm({
      entryDate: t.entryDate,
      exitDate: t.exitDate ?? "",
      category: t.category,
      symbol: t.symbol,
      description: t.description ?? "",
      market: t.market,
      quantity: String(t.quantity),
      entryPrice: String(t.entryPrice),
      exitPrice: t.exitPrice !== undefined ? String(t.exitPrice) : "",
      entryCommission:
        t.entryCommission !== undefined
          ? String(t.entryCommission)
          : t.fees !== undefined
            ? String(t.fees)
            : "",
      exitCommission:
        t.exitCommission !== undefined ? String(t.exitCommission) : "",
      dividendIncome:
        t.category !== "stocks" && t.dividendIncome !== undefined
          ? String(t.dividendIncome)
          : "",
      ideaSource: t.ideaSource ?? "",
      notes: t.notes ?? "",
      linkedAccountId: t.linkedAccountId ?? "",
    });
    setFormDividendPayments(t.dividendPayments ?? []);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function detectSymbol(raw: string) {
    if (!raw.trim()) return;
    if (form.category !== "stocks") {
      setForm((f) => ({ ...f, symbol: raw.trim().toUpperCase() }));
      return;
    }
    setDetecting(true);
    try {
      const res = await fetch(
        `/api/market/detect?symbol=${encodeURIComponent(raw.trim())}`,
      );
      const json = await res.json();
      if (res.ok) {
        const sym = normalizeSymbol(raw);
        const name = (json.quote?.name as string | undefined)?.trim();
        setForm((f) => ({
          ...f,
          market: json.market,
          symbol: sym,
          description:
            name && (!f.description.trim() || f.description.trim() === sym)
              ? name
              : f.description,
        }));
        if (json.usdToSgd && json.hkdToSgd) {
          setFx({ usdToSgd: json.usdToSgd, hkdToSgd: json.hkdToSgd });
        }
      } else {
        setMsg(json.error ?? "Ticker not found", "err");
      }
    } finally {
      setDetecting(false);
    }
  }

  function buildTradeFromForm(id: string): Trade | string {
    const qty = parseNum(form.quantity);
    const entry = parseNum(form.entryPrice);
    if (qty === undefined || qty <= 0 || entry === undefined || entry <= 0) {
      return "Quantity and entry price are required.";
    }
    const resolvedMarket =
      form.market ?? (form.category === "stocks" ? null : "SG");
    if (form.category === "stocks" && !resolvedMarket) {
      return "Tab out of the symbol field to detect SGX / HKEX / US market.";
    }

    const market = (resolvedMarket ?? "SG") as StockMarket;

    const base: Trade = {
      id,
      entryDate: form.entryDate,
      exitDate: form.exitDate.trim() || undefined,
      market,
      category: form.category,
      symbol:
        form.category === "stocks"
          ? normalizeSymbol(form.symbol)
          : form.symbol.trim(),
      description: form.description.trim() || undefined,
      quantity: qty,
      entryPrice: entry,
      exitPrice: parseNum(form.exitPrice),
      entryCommission: parseNum(form.entryCommission),
      exitCommission: parseNum(form.exitCommission),
      linkedAccountId: form.linkedAccountId || undefined,
      ideaSource: form.ideaSource.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    if (form.category === "stocks") {
      return {
        ...base,
        ...syncTradeDividendTotals(base, formDividendPayments),
      };
    }

    const dividendIncome = parseNum(form.dividendIncome);
    return {
      ...base,
      dividendIncome,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    let built = buildTradeFromForm(editingId ?? newId());
    if (typeof built === "string") {
      setMsg(built, "err");
      return;
    }

    if (built.category === "stocks" && !built.description?.trim()) {
      try {
        const res = await fetch(
          `/api/market/detect?symbol=${encodeURIComponent(built.symbol)}`,
        );
        const json = await res.json();
        if (res.ok && json.quote?.name) {
          built = { ...built, description: String(json.quote.name).trim() };
        }
      } catch {
        /* save without description */
      }
    }

    const nextTrades = editingId
      ? trades.map((t) => (t.id === editingId ? built : t))
      : [...trades, built];

    const ok = await saveData({ ...data, trades: nextTrades });
    if (!ok) return;
    setMsg(editingId ? "Trade updated." : "Trade added.");
    clearForm();
  }

  async function removeTrade(t: Trade) {
    if (!data) return;
    const label = `${t.symbol} (${t.entryDate})`;
    if (!window.confirm(`Remove trade ${label}? This cannot be undone.`)) return;

    const nextTrades = (data.trades ?? []).filter((x) => x.id !== t.id);
    const ok = await saveData({ ...data, trades: nextTrades });
    if (ok) {
      setMsg(`Removed ${t.symbol}.`);
      if (editingId === t.id) clearForm();
    }
  }

  async function fillFilteredDividends() {
    if (!data) return;
    const targets = filteredSgStocks;
    if (targets.length === 0) {
      setMsg(`No SG stock trades in “${filterLabel}”.`, "err");
      return;
    }
    const scope =
      filter === "all" || filter === "sg"
        ? `${targets.length} SG stock trade(s)`
        : `${targets.length} SG stock trade(s) in “${filterLabel}”`;
    const hasExisting = targets.some(tradeHasDividends);
    if (
      !window.confirm(
        `Fill SG dividends from Yahoo for ${scope}?` +
          (hasExisting
            ? " Existing dividend data on these trades will be replaced."
            : "") +
          " US stocks are not changed (enter those manually). Ex-dates in each holding window are summed.",
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/journal/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeIds: targets.map((t) => t.id) }),
      });
      const json = (await res.json()) as {
        filled?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        setMsg(json.error ?? "Fill dividends failed.", "err");
        return;
      }
      const refreshed = await loadFinanceData();
      setData(refreshed);
      await refreshQuotes(refreshed.trades ?? []);
      const filled = json.filled ?? 0;
      const skipped = json.skipped ?? 0;
      if (filled === 0) {
        setMsg(
          `No Yahoo dividends found in holding periods (${skipped} skipped).`,
          "err",
        );
        return;
      }
      setMsg(
        `Filled SG dividends on ${filled} trade(s)${filter === "all" || filter === "sg" ? "" : ` (${filterLabel})`}` +
          (skipped > 0 ? ` · ${skipped} with no ex-dates in window` : "") +
          ".",
      );
    } catch {
      setMsg("Fill dividends failed.", "err");
    } finally {
      setSaving(false);
    }
  }

  async function clearFilteredDividends() {
    if (!data) return;
    const targets = filteredSgWithDividends;
    if (targets.length === 0) {
      setMsg(`No SG dividends in “${filterLabel}”.`, "err");
      return;
    }
    const scope =
      filter === "all" || filter === "sg"
        ? `${targets.length} SG trade(s) with dividends`
        : `${targets.length} SG trade(s) with dividends in “${filterLabel}”`;
    if (
      !window.confirm(
        `Clear SG dividend data on ${scope}? US trades are not changed. This cannot be undone.`,
      )
    ) {
      return;
    }

    const ids = new Set(targets.map((t) => t.id));
    const { trades: nextTrades, cleared } = clearDividendsOnTrades(
      trades,
      ids,
    );
    if (cleared === 0) {
      setMsg("Nothing to clear.", "err");
      return;
    }

    if (editingId && ids.has(editingId)) {
      setFormDividendPayments([]);
      setForm((f) => ({ ...f, dividendIncome: "" }));
    }

    const ok = await saveData({ ...data, trades: nextTrades });
    if (ok) {
      setMsg(
        `Cleared SG dividends on ${cleared} trade(s)${filter === "all" || filter === "sg" ? "" : ` (${filterLabel})`}.`,
      );
    }
  }

  async function syncToInvestments() {
    if (!data) return;
    const derived = holdingsFromOpenTrades(data.trades ?? []);
    if (derived.length === 0) {
      setMsg(
        "No open stock trades to sync. Add a trade without an exit date, category Stocks.",
        "err",
      );
      return;
    }
    const manual = (data.holdings ?? []).filter(
      (h) => !h.id.startsWith("from-trade-"),
    );
    const ok = await saveData({
      ...data,
      holdings: [...manual, ...derived],
    });
    if (ok) {
      setMsg(
        `Synced ${derived.length} position(s) to Investments. Open that tab and refresh prices.`,
      );
    }
  }

  async function onImportCsv() {
    if (!importCsv.trim()) {
      setMsg("Paste or upload a CSV file first.", "err");
      return;
    }
    if (
      importMode === "replace" &&
      !window.confirm(
        "Replace all existing journal trades with the CSV? This cannot be undone.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/journal/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv, mode: importMode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "Import failed", "err");
        return;
      }
      const refreshed = await loadFinanceData();
      setData(refreshed);
      await refreshQuotes(refreshed.trades ?? []);
      setImportCsv("");
      setImportOpen(false);
      setMsg(
        `Imported ${json.added} trade(s)${
          json.duplicates ? ` (${json.duplicates} duplicates skipped)` : ""
        }.`,
      );
    } catch {
      setMsg("Import failed.", "err");
    } finally {
      setSaving(false);
    }
  }

  function onImportFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function fillDescriptions() {
    if (!data || trades.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/journal/enrich-descriptions", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "Could not fill descriptions", "err");
        return;
      }
      const refreshed = await loadFinanceData();
      setData(refreshed);
      await refreshQuotes(refreshed.trades ?? []);
      setMsg(
        json.updated > 0
          ? `Updated ${json.updated} description(s) from Yahoo Finance.`
          : "All stock trades already have descriptions.",
      );
    } catch {
      setMsg("Could not fill descriptions.", "err");
    } finally {
      setSaving(false);
    }
  }

  const brokerageAccounts = data
    ? listBrokerageAccounts(data.accounts)
    : [];

  const currencyHint =
    form.market === "US"
      ? "USD"
      : form.market === "HK"
        ? "HKD"
        : form.market === "SG"
          ? "SGD"
          : "native";

  if (!data) {
    return <p className="text-sm text-muted">Loading journal...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Trading journal</h2>
          <p className="text-sm text-secondary">
            Log each buy/sell once. Commission is in {currencyHint} per trade.
            US dividends: enter manually per trade. Fill / Clear applies to SG
            stocks in the current filter. Open stocks sync to{" "}
            <Link href="/investments" className="text-accent hover:underline">
              Investments
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={fillDescriptions}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm text-secondary hover:text-primary disabled:opacity-50"
          >
            Fill descriptions
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={syncToInvestments}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Sync open stocks → Investments
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setImportOpen((o) => !o)}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm text-secondary hover:text-primary disabled:opacity-50"
          >
            Import CSV
          </button>
        </div>
      </div>

      {importOpen ? (
        <section className="space-y-3 rounded-xl border border-surface-border bg-surface-raised p-4">
          <h3 className="text-sm font-medium text-primary">
            Import from Google Sheets
          </h3>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-secondary">
            <li>
              Open your{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/1VqcQay8x8Tk_-f4smRS7XIqFHNi-bjpWPsqMNQuDU6s/edit"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                trading journal sheet
              </a>
            </li>
            <li>
              For each tab (<strong>Trades</strong>, <strong>Others</strong>):
              File → Download → Comma-separated values (.csv)
            </li>
            <li>Upload each CSV below (import twice if you use both tabs)</li>
          </ol>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
              />
              <span className="text-secondary">Add new (skip duplicates)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
              />
              <span className="text-secondary">Replace all trades</span>
            </label>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-xs text-secondary"
            onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
          />
          <textarea
            className="w-full font-mono text-xs"
            rows={4}
            placeholder="Or paste CSV contents here..."
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || !importCsv.trim()}
            onClick={onImportCsv}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Importing..." : "Import trades"}
          </button>
        </section>
      ) : null}

      {message ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            messageTone === "err"
              ? "border-negative/40 bg-negative/10 text-negative"
              : "border-positive/40 bg-positive/10 text-positive"
          }`}
        >
          {message}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Realised P&amp;L</p>
          <p
            className={`font-mono text-xl font-semibold tabular-nums ${
              stats.realizedPnlSgd >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {fmt.currency(stats.realizedPnlSgd)}
          </p>
          <p className="text-xs text-muted">{stats.closedCount} closed</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Open unrealised</p>
          <p
            className={`font-mono text-xl font-semibold tabular-nums ${
              stats.openUnrealizedSgd >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {fmt.currency(stats.openUnrealizedSgd)}
          </p>
          <p className="text-xs text-muted">
            {stats.openCount} open · {fmt.currency(stats.openCostSgd)}
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Win rate</p>
          <p className="font-mono text-xl font-semibold text-primary">
            {stats.winRate !== null ? fmt.percent(stats.winRate) : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs uppercase text-muted">Avg win / loss</p>
          <p className="font-mono text-sm font-semibold text-positive">
            {stats.avgWinPct !== null
              ? fmt.percent(stats.avgWinPct, true)
              : "-"}
          </p>
          <p className="font-mono text-sm font-semibold text-negative">
            {stats.avgLossPct !== null
              ? fmt.percent(stats.avgLossPct)
              : "-"}
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {JOURNAL_FILTER_OPTIONS.map(({ key, label }) => (
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || filteredSgStocks.length === 0}
            onClick={() => void fillFilteredDividends()}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-secondary hover:border-accent/40 hover:text-accent disabled:opacity-50"
            title={
              filteredSgStocks.length === 0
                ? "No SG stock trades in this view"
                : "Yahoo ex-dates in holding window (SG only)"
            }
          >
            Fill dividends (SG)
            {filter === "all" ? "" : ` · ${filterLabel}`}
            {filteredSgStocks.length > 0 ? ` · ${filteredSgStocks.length}` : ""}
          </button>
          <button
            type="button"
            disabled={saving || filteredSgWithDividends.length === 0}
            onClick={() => void clearFilteredDividends()}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-secondary hover:border-negative/40 hover:text-negative disabled:opacity-50"
            title={
              filteredSgWithDividends.length === 0
                ? "No SG dividends in this view"
                : "SG only; US dividends are manual"
            }
          >
            Clear dividends (SG)
            {filter === "all" ? "" : ` · ${filterLabel}`}
            {filteredSgWithDividends.length > 0
              ? ` · ${filteredSgWithDividends.length}`
              : ""}
          </button>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-surface-raised text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-3">Entry</th>
                <th className="px-3 py-3">Exit</th>
                <th className="px-3 py-3">Ticker</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Entry</th>
                <th className="px-3 py-3 text-right">Last/Exit</th>
                <th className="px-3 py-3 text-right">Comm.</th>
                <th className="px-3 py-3 text-right">Div./share (net)</th>
                <th className="px-3 py-3 text-right">Div. total (net)</th>
                <th className="px-3 py-3 text-right">P&amp;L</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const q =
                  t.category === "stocks"
                    ? quoteMap.get(`${t.market}:${t.symbol.toUpperCase()}`)
                    : undefined;
                const mark = isTradeOpen(t) ? q?.price : t.exitPrice;
                const pnl = tradePnlSgd(t, mark, fx);
                const comm = tradeTotalCommission(t);
                const priceFmt = (n: number) => fmt.tradePrice(n, t.market);
                const div = tradeDividendSummary(t);
                return (
                  <tr key={t.id} className="border-t border-surface-border">
                    <td className="px-3 py-2.5 text-xs text-secondary">
                      {t.entryDate}
                      <br />
                      <span className="text-muted">{tradeDaysHeld(t)}d</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-secondary">
                      {t.exitDate ?? (
                        <span className="text-accent">Open</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-primary">
                        {t.symbol}
                      </span>
                      <span className="ml-1 text-[10px] text-muted">
                        {t.market}
                      </span>
                      {t.description || q?.name ? (
                        <p className="text-xs text-muted">
                          {t.description ?? q?.name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {t.quantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {priceFmt(t.entryPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {mark !== undefined ? priceFmt(mark) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted">
                      {comm > 0 ? priceFmt(comm) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted">
                      {div ? priceFmt(div.perShareNet) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted">
                      {div ? priceFmt(div.netTotal) : "-"}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono text-xs ${
                        pnl && pnl.pnlSgd >= 0
                          ? "text-positive"
                          : "text-negative"
                      }`}
                    >
                      {pnl
                        ? `${fmt.currency(pnl.pnlSgd)}${
                            pnl.pnlPct !== null
                              ? ` (${fmt.percent(pnl.pnlPct, true)})`
                              : ""
                          }`
                        : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => loadTradeToForm(t)}
                        className="mr-2 text-xs text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTrade(t)}
                        disabled={saving}
                        className="text-xs text-muted hover:text-negative disabled:opacity-50"
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
        <p className="text-sm text-muted">No trades in this view.</p>
      )}

      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-2xl space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-primary">
            {editingId ? "Edit trade" : "Log trade"}
          </h3>
          {editingId ? (
            <button
              type="button"
              onClick={clearForm}
              className="text-xs text-secondary hover:text-primary"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-secondary">Entry date</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={form.entryDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, entryDate: e.target.value }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Exit date (if closed)</span>
            <input
              type="date"
              className="mt-1 w-full"
              value={form.exitDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, exitDate: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Category</span>
            <select
              className="mt-1 w-full"
              value={form.category}
              onChange={(e) => {
                const cat = e.target.value as TradeCategory;
                setForm((f) => ({
                  ...f,
                  category: cat,
                  market: cat === "stocks" ? f.market : "SG",
                }));
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
            <span className="text-secondary">Ticker</span>
            <input
              className="mt-1 w-full font-mono uppercase"
              value={form.symbol}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  symbol: e.target.value,
                  market: f.category === "stocks" ? null : f.market,
                }))
              }
              onBlur={(e) => detectSymbol(e.target.value)}
              required
            />
            {form.category === "stocks" ? (
              <label className="mt-2 block text-xs">
                <span className="text-muted">Market</span>
                <select
                  className="mt-1 w-full"
                  value={form.market ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      market: (e.target.value || null) as StockMarket | null,
                    }))
                  }
                >
                  <option value="">Auto-detect</option>
                  <option value="SG">SG · SGD</option>
                  <option value="US">US · USD</option>
                  <option value="HK">HK · HKD</option>
                </select>
              </label>
            ) : null}
            {detecting ? (
              <p className="mt-1 text-xs text-muted">Detecting market...</p>
            ) : form.market && form.category === "stocks" ? (
              <p className="mt-1 text-xs text-positive">
                {form.market === "SG"
                  ? "SGX · SGD"
                  : form.market === "HK"
                    ? "HKEX · HKD"
                    : "US · USD"}
              </p>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="text-secondary">
              Company name (auto from ticker)
            </span>
            <input
              className="mt-1 w-full"
              placeholder="Filled when you tab out of symbol"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-secondary">Quantity</span>
            <input
              className="mt-1 w-full font-mono"
              value={form.quantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: e.target.value }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Entry price ({currencyHint})</span>
            <input
              className="mt-1 w-full font-mono"
              value={form.entryPrice}
              onChange={(e) =>
                setForm((f) => ({ ...f, entryPrice: e.target.value }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Exit price ({currencyHint})</span>
            <input
              className="mt-1 w-full font-mono"
              value={form.exitPrice}
              onChange={(e) =>
                setForm((f) => ({ ...f, exitPrice: e.target.value }))
              }
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-secondary">
              Buy commission ({currencyHint})
            </span>
            <input
              className="mt-1 w-full font-mono"
              placeholder="e.g. 2.50"
              value={form.entryCommission}
              onChange={(e) =>
                setForm((f) => ({ ...f, entryCommission: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">
              Sell commission ({currencyHint})
            </span>
            <input
              className="mt-1 w-full font-mono"
              placeholder="When closed"
              value={form.exitCommission}
              onChange={(e) =>
                setForm((f) => ({ ...f, exitCommission: e.target.value }))
              }
            />
          </label>
          {form.category !== "stocks" ? (
            <label className="block text-sm">
              <span className="text-secondary">
                Dividends total ({currencyHint}, optional)
              </span>
              <input
                className="mt-1 w-full font-mono"
                value={form.dividendIncome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dividendIncome: e.target.value }))
                }
              />
            </label>
          ) : null}
        </div>

        {form.category === "stocks" && form.market ? (
          <TradeDividendEditor
            market={form.market}
            quantity={Number(form.quantity.replace(/,/g, "")) || 0}
            entryDate={form.entryDate}
            exitDate={form.exitDate}
            symbol={form.symbol}
            category={form.category}
            payments={formDividendPayments}
            onChange={setFormDividendPayments}
          />
        ) : null}

        <label className="block text-sm">
          <span className="text-secondary">Brokerage</span>
          <select
            className="mt-1 w-full"
            value={form.linkedAccountId}
            onChange={(e) =>
              setForm((f) => ({ ...f, linkedAccountId: e.target.value }))
            }
          >
            <option value="">-</option>
            {brokerageAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {data && form.category === "stocks" ? (
          <BrokerageQuickAdd
            data={data}
            onSave={async (next) => {
              const result = await persistFinanceData(next);
              if (!result.ok) {
                setMsg(result.error, "err");
                return false;
              }
              setData(result.data);
              return true;
            }}
            onAdded={(a) =>
              setForm((f) => ({ ...f, linkedAccountId: a.id }))
            }
            showAccountsLink={false}
            compact
          />
        ) : null}

        <label className="block text-sm">
          <span className="text-secondary">Idea source / notes</span>
          <input
            className="mt-1 w-full"
            value={form.ideaSource}
            onChange={(e) =>
              setForm((f) => ({ ...f, ideaSource: e.target.value }))
            }
            placeholder="PT Alumni, ASSI..."
          />
        </label>

        <button
          type="submit"
          disabled={saving || (form.category === "stocks" && !form.market)}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : editingId
              ? "Save changes"
              : "Add to journal"}
        </button>
      </form>
    </div>
  );
}
