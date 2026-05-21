import type { Account } from "./types";

export const BROKERAGE_PRESETS: {
  name: string;
  notes?: string;
}[] = [
  { name: "Moomoo", notes: "Stocks & ETFs" },
  { name: "Webull", notes: "US stocks & options" },
  { name: "Syfe", notes: "Robo / portfolios" },
  { name: "Endowus", notes: "Funds & CPF/SRS" },
  { name: "Tiger Brokers", notes: "Stocks & ETFs" },
  { name: "Interactive Brokers", notes: "Global markets" },
];

export function brokerageNamesLabel(): string {
  return BROKERAGE_PRESETS.map((b) => b.name).join(", ");
}

export function listBrokerageAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.archived && a.category === "investments");
}

export function createBrokerageAccount(
  name: string,
  notes?: string,
): Account {
  return {
    id: `acct-${Date.now().toString(36)}`,
    name: name.trim(),
    category: "investments",
    notes: notes?.trim() || undefined,
  };
}
