import { normalizeSymbol } from "./market";
import type { StockMarket, Trade, TradeCategory } from "./types";

export type ImportResult = {
  trades: Trade[];
  skipped: number;
  errors: string[];
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function parseNum(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const t = raw.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!t || t === "-" || t === "—") return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

function parseSheetDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapCategory(raw: string | undefined): TradeCategory {
  const c = (raw ?? "").toLowerCase();
  if (c.includes("govt") || c.includes("government") || c.includes("t-bill"))
    return "govt";
  if (c.includes("robo")) return "robo";
  if (c.includes("stock")) return "stocks";
  return "other";
}

function mapMarket(geo: string | undefined, currency: string | undefined): StockMarket {
  const g = (geo ?? "").toUpperCase();
  const cur = (currency ?? "").toUpperCase();
  if (g.includes("U.S") || g === "US" || cur === "USD") return "US";
  if (g.includes("HONG") || g === "HK" || cur === "HKD") return "HK";
  return "SG";
}

function tradeSignature(t: Trade): string {
  return `${t.entryDate}|${t.symbol}|${t.quantity}|${t.entryPrice}|${t.exitDate ?? ""}`;
}

function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((r) =>
    r.some((c) => c.trim().toLowerCase() === "geography"),
  );
}

function colIndex(row: string[], ...names: string[]): number {
  const lower = row.map((c) => c.trim().toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function cell(row: string[], i: number): string {
  return row[i]?.trim() ?? "";
}

/**
 * Parse CSV exported from the Google Sheets trading journal (Trades or Others tab).
 */
export function parseJournalCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const errors: string[] = [];
  const trades: Trade[] = [];
  let skipped = 0;

  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) {
    return {
      trades: [],
      skipped: 0,
      errors: [
        "Could not find a header row with “Geography”. Export the Trades or Others tab as CSV.",
      ],
    };
  }

  const header = rows[headerIdx];
  const geoIdx = colIndex(header, "geography");
  const catIdx = colIndex(header, "category");
  const tickerIdx = colIndex(header, "ticker");
  const descIdx = colIndex(header, "description");

  if (geoIdx < 0 || tickerIdx < 0) {
    return {
      trades: [],
      skipped: 0,
      errors: ["Missing Geography or Ticker column in CSV header."],
    };
  }

  // Data layout: dates in cols 1–2; qty/entry/exit follow description in sheet export
  const qtyIdx = descIdx >= 0 ? descIdx + 2 : geoIdx + 6;
  const entryIdx = qtyIdx + 1;
  const exitIdx = entryIdx + 1;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const tickerRaw = cell(row, tickerIdx);
    if (!tickerRaw || tickerRaw === "-" || tickerRaw.toLowerCase() === "ticker")
      continue;

    const entryDate = parseSheetDate(cell(row, 1));
    if (!entryDate) {
      skipped++;
      continue;
    }

    const category = mapCategory(cell(row, catIdx));
    const market = mapMarket(cell(row, geoIdx), cell(row, geoIdx + 1));
    const quantity = parseNum(cell(row, qtyIdx));
    const entryPrice = parseNum(cell(row, entryIdx));

    if (quantity === undefined || quantity <= 0 || entryPrice === undefined) {
      errors.push(`Row ${r + 1}: invalid quantity or entry price for ${tickerRaw}`);
      skipped++;
      continue;
    }

    const exitDate = parseSheetDate(cell(row, 2));
    const exitPrice = parseNum(cell(row, exitIdx));
    const dividendIncome = parseNum(cell(row, exitIdx + 2));

    // Notes / idea source: last non-numeric text columns
    const tail = row.slice(exitIdx + 4).map((c) => c.trim()).filter(Boolean);
    const notes = tail.length > 0 ? tail[tail.length - 1] : undefined;
    const ideaSource =
      tail.length > 1 ? tail[tail.length - 2] : undefined;

    const symbol =
      category === "stocks"
        ? normalizeSymbol(tickerRaw)
        : tickerRaw.trim();

    trades.push({
      id: `tr-import-${r}-${symbol}-${entryDate}`,
      entryDate,
      exitDate: exitDate ?? undefined,
      market,
      category,
      symbol,
      description: descIdx >= 0 ? cell(row, descIdx) || undefined : undefined,
      quantity,
      entryPrice,
      exitPrice: exitPrice && exitPrice > 0 ? exitPrice : undefined,
      dividendIncome:
        dividendIncome && dividendIncome > 0 ? dividendIncome : undefined,
      ideaSource:
        ideaSource && !ideaSource.includes("%") ? ideaSource : undefined,
      notes: notes && !notes.includes("%") ? notes : undefined,
    });
  }

  return { trades, skipped, errors };
}

export function mergeImportedTrades(
  existing: Trade[],
  imported: Trade[],
  mode: "merge" | "replace",
): { trades: Trade[]; added: number; duplicates: number } {
  if (mode === "replace") {
    return { trades: imported, added: imported.length, duplicates: 0 };
  }

  const seen = new Set(existing.map(tradeSignature));
  let added = 0;
  let duplicates = 0;
  const next = [...existing];

  for (const t of imported) {
    const sig = tradeSignature(t);
    if (seen.has(sig)) {
      duplicates++;
      continue;
    }
    seen.add(sig);
    next.push({ ...t, id: `tr-${Date.now().toString(36)}-${added}` });
    added++;
  }

  return { trades: next, added, duplicates };
}
