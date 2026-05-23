import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const p = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/lib/dividends.ts",
);

let s = fs.readFileSync(p, "utf8");

if (!s.includes("tradeDividendSummary")) {
  const append = `

import type { DividendPaymentRecord } from "./dividends";

export type TradeDividendSummary = {
  netTotal: number;
  grossTotal?: number;
  perShareNet: number;
  perShareGross?: number;
  payments: DividendPaymentRecord[];
};

export function tradeDividendSummary(trade: Trade): TradeDividendSummary | null {
  if (trade.quantity <= 0) return null;

  if (trade.dividendPayments && trade.dividendPayments.length > 0) {
    const perShareGross = trade.dividendPayments.reduce(
      (sum, p) => sum + p.amountPerShare,
      0,
    );
    const grossTotal = Math.round(perShareGross * trade.quantity * 100) / 100;
    const netTotal = netDividendFromGross(trade.market, grossTotal);
    return {
      netTotal,
      grossTotal: trade.market === "US" ? grossTotal : undefined,
      perShareNet: Math.round((netTotal / trade.quantity) * 10000) / 10000,
      perShareGross:
        trade.market === "US"
          ? Math.round(perShareGross * 10000) / 10000
          : undefined,
      payments: trade.dividendPayments,
    };
  }

  if (trade.dividendIncome === undefined) return null;

  const netTotal = trade.dividendIncome;
  const grossTotal = trade.dividendGross;
  return {
    netTotal,
    grossTotal,
    perShareNet: Math.round((netTotal / trade.quantity) * 10000) / 10000,
    perShareGross:
      grossTotal !== undefined
        ? Math.round((grossTotal / trade.quantity) * 10000) / 10000
        : undefined,
    payments: [],
  };
}
`;
  // Fix circular import - DividendPaymentRecord is in same file
  const fixed = append.replace(
    'import type { DividendPaymentRecord } from "./dividends";\n\n',
    "",
  );
  s += fixed;
  fs.writeFileSync(p, s);
  console.log("appended tradeDividendSummary");
} else {
  console.log("already present");
}
