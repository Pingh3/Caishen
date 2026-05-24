"use client";

import Link from "next/link";
import { useState } from "react";
import {
  formatBreakdownAmount,
  type StatBreakdown,
} from "@/lib/dashboard-breakdown";
import { StatCard } from "./StatCard";

export type DashboardStatItem = {
  breakdownId: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "default" | "positive" | "negative";
};

type Props = {
  stats: DashboardStatItem[];
  breakdowns: StatBreakdown[];
};

export function DashboardStats({ stats, breakdowns }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const active = breakdowns.find((b) => b.id === openId);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard
            key={s.breakdownId}
            label={s.label}
            value={s.value}
            sub={s.sub}
            tone={s.tone}
            active={openId === s.breakdownId}
            onClick={() => toggle(s.breakdownId)}
          />
        ))}
      </section>

      {active ? (
        <section
          className="rounded-xl border border-accent/30 bg-surface-raised p-5"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-primary">
                {active.title}
              </h2>
              {active.footnote ? (
                <p className="mt-1 text-xs text-muted">{active.footnote}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="text-xs text-muted hover:text-primary"
            >
              Close
            </button>
          </div>

          <table className="mt-4 w-full text-sm">
            <tbody>
              {active.lines.map((line, i) => {
                if (line.note) {
                  return (
                    <tr key={`note-${i}`}>
                      <td
                        colSpan={2}
                        className={`py-2 text-xs ${
                          line.muted ? "text-muted" : "text-secondary"
                        }`}
                      >
                        {line.label}
                      </td>
                    </tr>
                  );
                }

                const amountClass =
                  line.amount !== undefined && line.amount < 0
                    ? "text-negative"
                    : line.muted
                      ? "text-muted"
                      : "text-primary";

                return (
                  <tr
                    key={`${line.label}-${i}`}
                    className="border-t border-surface-border/50 first:border-t-0"
                  >
                    <td className={`py-2.5 pr-4 ${line.muted ? "text-muted" : "text-primary"}`}>
                      {line.href ? (
                        <Link
                          href={line.href}
                          className="text-accent hover:underline"
                        >
                          {line.label}
                        </Link>
                      ) : (
                        line.label
                      )}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono tabular-nums ${amountClass}`}
                    >
                      {line.amount !== undefined
                        ? formatBreakdownAmount(line.amount)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-border">
                <td className="pt-3 font-medium text-primary">
                  {active.totalLabel}
                </td>
                <td className="pt-3 text-right font-mono text-lg font-semibold tabular-nums text-primary">
                  {formatBreakdownAmount(active.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      ) : null}
    </div>
  );
}

