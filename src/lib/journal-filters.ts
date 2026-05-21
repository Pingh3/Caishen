import type { Trade } from "./types";
import { isTradeOpen } from "./trades";

export type JournalFilter =
  | "all"
  | "open"
  | "closed"
  | "stocks"
  | "robo"
  | "market_funds"
  | "us"
  | "sg"
  | "hk"
  | "others";

export const JOURNAL_FILTER_OPTIONS: { key: JournalFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "stocks", label: "Stocks" },
  { key: "robo", label: "Robo" },
  { key: "market_funds", label: "Market Funds" },
  { key: "us", label: "US" },
  { key: "sg", label: "SG" },
  { key: "hk", label: "HK" },
  { key: "others", label: "Others" },
];

export function matchesJournalFilter(
  trade: Trade,
  filter: JournalFilter,
): boolean {
  switch (filter) {
    case "open":
      return isTradeOpen(trade);
    case "closed":
      return !isTradeOpen(trade);
    case "stocks":
      return trade.category === "stocks";
    case "robo":
      return trade.category === "robo";
    case "market_funds":
      return trade.category === "other";
    case "us":
      return trade.category === "stocks" && trade.market === "US";
    case "sg":
      return trade.category === "stocks" && trade.market === "SG";
    case "hk":
      return trade.category === "stocks" && trade.market === "HK";
    case "others":
      return trade.category === "govt";
    default:
      return true;
  }
}
