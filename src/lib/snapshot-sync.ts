import type { Account, FinanceData, Snapshot } from "./types";

/** Stock brokerages synced via Investments → Sync to snapshot. */
export const INVESTMENTS_SYNC_BROKER_NAMES = ["Moomoo", "Webull"] as const;

export type SnapshotSyncSource = "investments" | "property";

export function accountSnapshotSyncSource(
  account: Account,
  data: Pick<FinanceData, "holdings" | "trades">,
): SnapshotSyncSource | null {
  if (account.category === "property") return "property";

  if (account.category === "investments") {
    const name = account.name.trim().toLowerCase();
    const isNamedBroker = INVESTMENTS_SYNC_BROKER_NAMES.some(
      (b) => name === b.toLowerCase() || name.startsWith(`${b.toLowerCase()} `),
    );
    const hasLinkedHoldings = (data.holdings ?? []).some(
      (h) => h.linkedAccountId === account.id,
    );
    const hasLinkedOpenTrades = (data.trades ?? []).some(
      (t) =>
        t.linkedAccountId === account.id &&
        !t.exitDate &&
        t.category === "stocks",
    );
    if (isNamedBroker || hasLinkedHoldings || hasLinkedOpenTrades) {
      return "investments";
    }
  }

  return null;
}

export function isSnapshotBalanceReadOnly(
  account: Account,
  data: Pick<FinanceData, "holdings" | "trades">,
): boolean {
  return accountSnapshotSyncSource(account, data) !== null;
}

export function snapshotSyncLabel(source: SnapshotSyncSource): string {
  return source === "investments" ? "Investments" : "Property";
}

/** Investments: editable manual accounts first, synced brokerages last. */
export function sortAccountsForSnapshotEntry(
  accounts: Account[],
  data: Pick<FinanceData, "holdings" | "trades">,
): Account[] {
  return [...accounts].sort((a, b) => {
    const aRead = isSnapshotBalanceReadOnly(a, data);
    const bRead = isSnapshotBalanceReadOnly(b, data);
    if (aRead !== bRead) return aRead ? 1 : -1;
    const aMarket =
      a.category === "investments" &&
      a.name.toLowerCase().includes("market fund");
    const bMarket =
      b.category === "investments" &&
      b.name.toLowerCase().includes("market fund");
    if (aMarket !== bMarket) return aMarket ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function parseSnapshotBalances(
  accounts: Account[],
  balances: Record<string, string>,
  data: FinanceData,
  latest: Snapshot | null,
): { parsed: Record<string, number>; error?: string } {
  const parsed: Record<string, number> = {};

  for (const a of accounts) {
    if (isSnapshotBalanceReadOnly(a, data)) {
      const prev = latest?.balances[a.id];
      if (prev !== undefined) parsed[a.id] = prev;
      continue;
    }

    const raw = balances[a.id]?.trim();
    if (!raw) continue;
    const n = Number(raw.replace(/,/g, ""));
    if (Number.isNaN(n)) {
      return { parsed: {}, error: `Invalid amount for ${a.name}` };
    }
    parsed[a.id] = n;
  }

  return { parsed };
}
