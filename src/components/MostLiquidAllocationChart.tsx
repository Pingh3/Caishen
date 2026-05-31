"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { usePrivacy } from "@/components/PrivacyProvider";
import { formatCurrency, formatPercent } from "@/lib/finance";
import {
  MOST_LIQUID_BUCKET_COLORS,
  type MostLiquidAllocationResult,
} from "@/lib/most-liquid-allocation";

type Props = {
  allocation: MostLiquidAllocationResult;
};

export function MostLiquidAllocationChart({ allocation }: Props) {
  const { hideAmounts } = usePrivacy();
  const { slices, targets, stocksFundsPct, sgShareOfStocksFundsPct } =
    allocation;

  if (allocation.total <= 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted">
        No most-liquid balances in the latest snapshot.
      </div>
    );
  }

  const barData = slices.map((s) => ({
    name: s.name,
    pct: s.pct,
    value: s.value,
    id: s.id,
  }));

  const stocksFundsOver = stocksFundsPct > targets.maxStocksFundsPct;
  const sgShareOk =
    sgShareOfStocksFundsPct !== null &&
    sgShareOfStocksFundsPct >= targets.sgShareOfStocksFundsPct - 2;

  return (
    <div className="space-y-5">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={barData}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid
            stroke="rgb(var(--surface-border))"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={108}
            tick={{ fill: "rgb(var(--text-secondary))", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--surface-raised))",
              border: "1px solid rgb(var(--surface-border))",
              borderRadius: 8,
              fontSize: 13,
              color: "rgb(var(--text-primary))",
            }}
            formatter={(value: number, _name: string, item) => {
              const row = item.payload as (typeof barData)[0];
              return [
                `${formatPercent(value, false, hideAmounts)} · ${formatCurrency(row.value, false, hideAmounts)}`,
                row.name,
              ];
            }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {barData.map((entry) => (
              <Cell
                key={entry.id}
                fill={MOST_LIQUID_BUCKET_COLORS[entry.id]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between text-xs text-secondary"
          >
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: MOST_LIQUID_BUCKET_COLORS[s.id] }}
              />
              {s.name}
            </span>
            <span className="font-mono tabular-nums">
              {formatPercent(s.pct, false, hideAmounts)}{" "}
              <span className="text-muted">
                ({formatCurrency(s.value, false, hideAmounts)})
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-surface-border bg-surface/50 p-3 text-xs">
        <p className="font-medium text-primary">Your plan</p>
        <dl className="mt-2 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-secondary">Stocks &amp; funds (max)</dt>
            <dd className="font-mono tabular-nums">
              <span className={stocksFundsOver ? "text-negative" : "text-primary"}>
                {formatPercent(stocksFundsPct, false, hideAmounts)}
              </span>
              <span className="text-muted">
                {" "}
                / {targets.maxStocksFundsPct}% cap
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-secondary">SG within stocks &amp; funds</dt>
            <dd className="font-mono tabular-nums">
              <span
                className={
                  sgShareOfStocksFundsPct === null
                    ? "text-muted"
                    : sgShareOk
                      ? "text-positive"
                      : "text-primary"
                }
              >
                {sgShareOfStocksFundsPct !== null
                  ? formatPercent(sgShareOfStocksFundsPct, false, hideAmounts)
                  : "—"}
              </span>
              <span className="text-muted">
                {" "}
                / {targets.sgShareOfStocksFundsPct}% target
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-secondary">Implied SG of most liquid</dt>
            <dd className="font-mono tabular-nums text-muted">
              {formatPercent(
                allocation.sgStocksPctOfTotal,
                false,
                hideAmounts,
              )}{" "}
              (plan ~{targets.sgStocksPctOfTotalAtPlan}% at full cap)
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-muted">
          Edit targets in{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
          . Link holdings on{" "}
          <Link href="/investments" className="text-accent hover:underline">
            Investments
          </Link>{" "}
          for SG vs US/HK split.
        </p>
      </div>
    </div>
  );
}
