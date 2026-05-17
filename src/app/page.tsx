import { AllocationChart } from "@/components/AllocationChart";
import { InsightsPanel } from "@/components/InsightsPanel";
import { NetWorthChart } from "@/components/NetWorthChart";
import { StatCard } from "@/components/StatCard";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  allocationPercents,
  buildAllocationSlices,
  categoryTotals,
  formatCurrency,
  formatPercent,
  generateInsights,
  latestSnapshot,
  monthOverMonthChange,
  previousSnapshot,
  snapshotNetWorth,
  sortSnapshots,
} from "@/lib/finance";
import { fetchUsdToSgd } from "@/lib/market";
import { readFinanceData } from "@/lib/storage";
import { computeJournalStats } from "@/lib/trades";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await readFinanceData();
  const accounts = data.accounts.filter((a) => !a.archived);
  const latest = latestSnapshot(data);
  const insights = generateInsights(data);

  if (!latest) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border p-12 text-center">
        <p className="text-lg font-medium text-primary">No snapshots yet</p>
        <p className="mt-2 text-sm text-muted">
          Go to Update to record your first month, or edit{" "}
          <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs">
            data/finance.json
          </code>
          .
        </p>
      </div>
    );
  }

  const netWorth = snapshotNetWorth(latest, accounts);
  const prev = previousSnapshot(data, latest);
  const prevNw = prev ? snapshotNetWorth(prev, accounts) : null;
  const { delta, percent } = monthOverMonthChange(netWorth, prevNw);
  const totals = categoryTotals(latest, accounts);
  const allocation = buildAllocationSlices(
    allocationPercents(totals).map((x) => ({
      category: x.category,
      value: x.value,
    })),
  );

  const chartData = sortSnapshots(data.snapshots).map((s) => ({
    date: s.date,
    label: new Date(s.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    netWorth: snapshotNetWorth(s, accounts),
  }));

  const momTone =
    delta > 0 ? "positive" : delta < 0 ? "negative" : ("default" as const);

  const usdToSgd = await fetchUsdToSgd();
  const journalStats = computeJournalStats(
    data.trades ?? [],
    new Map(),
    usdToSgd,
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Net worth"
          value={formatCurrency(netWorth)}
          sub={new Date(latest.date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        />
        <StatCard
          label="Month over month"
          value={
            percent !== null
              ? formatPercent(percent, true)
              : formatCurrency(delta, true)
          }
          sub={
            percent !== null
              ? `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}`
              : "First comparison"
          }
          tone={momTone}
        />
        <StatCard
          label="Investable assets"
          value={formatCurrency(
            totals.cash +
              totals.investments +
              totals.retirement +
              totals.other_asset,
          )}
          sub="Cash + investments + retirement + other"
        />
        <StatCard
          label="Liabilities"
          value={formatCurrency(Math.abs(totals.liability))}
          sub={
            totals.liability < 0
              ? `${((Math.abs(totals.liability) / netWorth) * 100).toFixed(0)}% of net worth`
              : undefined
          }
          tone={totals.liability < 0 ? "negative" : "default"}
        />
      </section>

      {(data.trades?.length ?? 0) > 0 ? (
        <section className="rounded-xl border border-surface-border bg-surface-raised p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium text-primary">Trading journal</h2>
              <p className="text-xs text-muted">
                {journalStats.openCount} open · {journalStats.closedCount} closed
              </p>
            </div>
            <Link
              href="/journal"
              className="text-sm text-accent hover:underline"
            >
              View journal →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Realised P&amp;L</p>
              <p
                className={`font-mono text-lg font-semibold tabular-nums ${
                  journalStats.realizedPnlSgd >= 0
                    ? "text-positive"
                    : "text-negative"
                }`}
              >
                {formatCurrency(journalStats.realizedPnlSgd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Open positions</p>
              <p className="font-mono text-lg font-semibold text-primary">
                {formatCurrency(journalStats.openCostSgd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Win rate (closed)</p>
              <p className="font-mono text-lg font-semibold text-primary">
                {journalStats.winRate !== null
                  ? formatPercent(journalStats.winRate)
                  : "—"}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-surface-border p-5 text-center">
          <p className="text-sm text-secondary">
            <Link href="/journal" className="text-accent hover:underline">
              Start your trading journal
            </Link>{" "}
            to track entries, P&amp;L, and link open trades to Investments.
          </p>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 lg:col-span-3">
          <h2 className="text-sm font-medium text-primary">Net worth over time</h2>
          <div className="mt-4">
            <NetWorthChart data={chartData} />
          </div>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 lg:col-span-2">
          <h2 className="text-sm font-medium text-primary">Allocation</h2>
          <p className="text-xs text-muted">Latest snapshot by category</p>
          <div className="mt-4">
            <AllocationChart slices={allocation} />
          </div>
          <ul className="mt-2 space-y-1">
            {allocation.map((s) => (
              <li
                key={s.category}
                className="flex justify-between text-xs text-secondary"
              >
                <span>{s.name}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(s.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
          <h2 className="text-sm font-medium text-primary">Breakdown</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-muted">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                const v = totals[cat];
                if (v === 0 && cat !== "liability") return null;
                return (
                  <tr key={cat} className="border-b border-surface-border/50">
                    <td className="py-2.5 text-primary">
                      {CATEGORY_LABELS[cat]}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono tabular-nums ${
                        v < 0 ? "text-negative" : "text-primary"
                      }`}
                    >
                      {formatCurrency(Math.abs(v) * (v < 0 ? -1 : 1))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <InsightsPanel insights={insights} />
      </section>
    </div>
  );
}
