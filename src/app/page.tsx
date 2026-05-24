import { AllocationChart } from "@/components/AllocationChart";
import { DashboardStats } from "@/components/DashboardStats";
import { InsightsPanel } from "@/components/InsightsPanel";
import { NetWorthChart } from "@/components/NetWorthChart";
import { buildAllDashboardBreakdowns } from "@/lib/dashboard-breakdown";
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
  insuranceTotal,
  personalLoansTotal,
  snapshotLiquidNetWorth,
  snapshotMostLiquidNetWorth,
  snapshotNetWorth,
  vehicleValue,
  vehicleEquity,
  propertyNetEquity,
  propertyGrossValue,
  mortgageOwed,
  retirementTotal,
  sortSnapshots,
} from "@/lib/finance";
import { fetchFxRates } from "@/lib/market";
import { readFinanceData } from "@/lib/storage";
import { buildProjections } from "@/lib/projection";
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

  const policies = data.insurancePolicies;
  const loans = data.personalLoans;
  const vehicle = data.vehicle;
  const property = data.property;
  const netWorth = snapshotNetWorth(
    latest,
    accounts,
    policies,
    loans,
    vehicle,
    property,
  );
  const liquidNw = snapshotLiquidNetWorth(latest, accounts, policies, loans);
  const mostLiquidNw = snapshotMostLiquidNetWorth(latest, accounts);
  const cpfSrs = retirementTotal(latest, accounts);
  const insTotal = insuranceTotal(policies);
  const loansTotal = personalLoansTotal(loans);
  const prev = previousSnapshot(data, latest);
  const prevNw = prev
    ? snapshotNetWorth(prev, accounts, policies, loans, vehicle, property)
    : null;
  const vehicleVal = vehicleValue(vehicle);
  const vehicleEq = vehicleEquity(vehicle, latest, accounts);
  const prevLiquid = prev
    ? snapshotLiquidNetWorth(prev, accounts, policies, loans)
    : null;
  const prevMostLiquid = prev
    ? snapshotMostLiquidNetWorth(prev, accounts)
    : null;
  const { delta, percent } = monthOverMonthChange(netWorth, prevNw);
  const liquidDelta = monthOverMonthChange(liquidNw, prevLiquid);
  const mostLiquidDelta = monthOverMonthChange(mostLiquidNw, prevMostLiquid);
  const totals = categoryTotals(latest, accounts);
  const propertyNet = propertyNetEquity(latest, accounts, property);
  const propertyGross = propertyGrossValue(latest, accounts, property);
  const propertyMortgage = mortgageOwed(latest, accounts, property);
  const totalsForAllocation = {
    ...totals,
    property: propertyNet,
  };
  const allocationBase = allocationPercents(totalsForAllocation).map((x) => ({
    category: x.category,
    value: x.value,
  }));
  if (vehicleVal > 0) {
    const other = allocationBase.find((x) => x.category === "other_asset");
    if (other) other.value += vehicleVal;
    else
      allocationBase.push({ category: "other_asset" as const, value: vehicleVal });
  }
  const allocation = buildAllocationSlices(allocationBase);

  const chartData = sortSnapshots(data.snapshots).map((s) => ({
    date: s.date,
    label: new Date(s.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    netWorth: snapshotNetWorth(s, accounts, policies, loans, vehicle, property),
    liquidNetWorth: snapshotLiquidNetWorth(s, accounts, policies, loans),
  }));

  const momTone =
    delta > 0 ? "positive" : delta < 0 ? "negative" : ("default" as const);

  const breakdowns = buildAllDashboardBreakdowns(data, latest, prev, accounts);

  const fx = await fetchFxRates();
  const journalStats = computeJournalStats(
    data.trades ?? [],
    new Map(),
    fx,
  );

  const projections = buildProjections(data, accounts);
  const returnPct = data.settings?.projectionReturnPct ?? 5;

  return (
    <div className="space-y-8">
      <DashboardStats
        breakdowns={breakdowns}
        stats={[
          {
            breakdownId: "net-worth",
            label: "Net worth",
            value: formatCurrency(netWorth),
            sub: new Date(latest.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
          },
          {
            breakdownId: "liquid-net-worth",
            label: "Liquid net worth",
            value: formatCurrency(liquidNw),
            sub: `Excludes CPF/SRS (${formatCurrency(cpfSrs)}), property, vehicle & HDB loan`,
          },
          {
            breakdownId: "most-liquid-net-worth",
            label: "Most liquid net worth",
            value: formatCurrency(mostLiquidNw),
            sub:
              mostLiquidDelta.percent !== null
                ? `Cash & investments · ${formatPercent(mostLiquidDelta.percent, true)} MoM`
                : "Cash & investments only",
          },
          {
            breakdownId: "mom",
            label: "Month over month",
            value:
              percent !== null
                ? formatPercent(percent, true)
                : `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}`,
            sub:
              liquidDelta.percent !== null
                ? `Liquid ${formatPercent(liquidDelta.percent, true)}`
                : percent !== null
                  ? `${delta >= 0 ? "+" : ""}${formatCurrency(delta)} vs prior snapshot`
                  : "First comparison",
            tone: momTone,
          },
          {
            breakdownId: "insurance",
            label: "Insurance (surrender)",
            value: formatCurrency(insTotal),
            sub: (
              <Link href="/insurance" className="text-accent hover:underline">
                Manage policies
              </Link>
            ),
          },
          {
            breakdownId: "loans",
            label: "Loans to others",
            value: formatCurrency(loansTotal),
            sub: (
              <Link href="/loans" className="text-accent hover:underline">
                Manage loans
              </Link>
            ),
          },
          ...(vehicleVal > 0
            ? [
                {
                  breakdownId: "vehicle" as const,
                  label: "Vehicle",
                  value: formatCurrency(vehicleVal),
                  sub: (
                    <Link href="/vehicle" className="text-accent hover:underline">
                      Net equity {formatCurrency(vehicleEq)}
                    </Link>
                  ),
                },
              ]
            : []),
          {
            breakdownId: "investable",
            label: "Investable (incl. CPF)",
            value: formatCurrency(
              totals.cash +
                totals.investments +
                totals.retirement +
                totals.other_asset +
                insTotal,
            ),
            sub: "Cash + investments + CPF/SRS + other",
          },
          {
            breakdownId: "liabilities",
            label: "Liabilities",
            value: formatCurrency(Math.abs(totals.liability)),
            sub:
              totals.liability < 0
                ? `${((Math.abs(totals.liability) / netWorth) * 100).toFixed(0)}% of net worth`
                : undefined,
            tone: totals.liability < 0 ? "negative" : "default",
          },
        ]}
      />

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

      {projections ? (
        <section className="rounded-xl border border-surface-border bg-surface-raised p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium text-primary">
                Future projections
              </h2>
              <p className="text-xs text-muted">
                ~{formatCurrency(projections.monthlySavings)}/mo savings ·{" "}
                {returnPct}% p.a. return · not financial advice
              </p>
            </div>
            <Link
              href="/settings"
              className="text-sm text-accent hover:underline"
            >
              Edit income →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {projections.rows.map((row) => (
              <div
                key={row.years}
                className="rounded-lg border border-surface-border bg-surface px-3 py-3"
              >
                <p className="text-xs uppercase text-muted">{row.label}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-primary">
                  {formatCurrency(row.netWorth)}
                </p>
                <p className="text-[10px] text-muted">
                  +
                  {formatCurrency(row.netWorth - netWorth)} vs today
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-surface-border p-5">
          <h2 className="text-sm font-medium text-primary">
            Future projections
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Add{" "}
            <Link href="/settings" className="text-accent hover:underline">
              gross monthly income
            </Link>{" "}
            and{" "}
            <Link href="/accounts" className="text-accent hover:underline">
              monthly expenses
            </Link>{" "}
            (on Accounts or Update) to see estimated net worth in 1–20 years.
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
              {insTotal > 0 ? (
                <tr className="border-b border-surface-border/50">
                  <td className="py-2.5 text-primary">
                    Insurance (surrender)
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-primary">
                    {formatCurrency(insTotal)}
                  </td>
                </tr>
              ) : null}
              {vehicleVal > 0 ? (
                <tr className="border-b border-surface-border/50">
                  <td className="py-2.5 text-primary">
                    <Link href="/vehicle" className="hover:text-accent">
                      Vehicle
                      {vehicle?.makeModel ? ` (${vehicle.makeModel})` : ""}
                    </Link>
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-primary">
                    {formatCurrency(vehicleVal)}
                  </td>
                </tr>
              ) : null}
              {propertyNet > 0 ? (
                <>
                  <tr className="border-b border-surface-border/50">
                    <td className="py-2.5 text-primary">
                      <Link href="/property" className="hover:text-accent">
                        Property (value)
                      </Link>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-primary">
                      {formatCurrency(propertyGross)}
                    </td>
                  </tr>
                  {propertyMortgage > 0 ? (
                    <tr className="border-b border-surface-border/50">
                      <td className="py-2.5 pl-4 text-secondary">
                        Less mortgage / HDB loan
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-negative">
                        −{formatCurrency(propertyMortgage)}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="border-b border-surface-border/50">
                    <td className="py-2.5 pl-4 font-medium text-primary">
                      Property (net equity)
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-primary">
                      {formatCurrency(propertyNet)}
                    </td>
                  </tr>
                </>
              ) : null}
              {CATEGORY_ORDER.map((cat) => {
                if (cat === "property") return null;
                let v = totals[cat];
                if (cat === "liability") {
                  v =
                    totals.liability +
                    (propertyMortgage > 0 ? propertyMortgage : 0);
                }
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
