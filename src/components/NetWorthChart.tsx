"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/finance";

type Point = {
  date: string;
  netWorth: number;
  liquidNetWorth?: number;
  label: string;
};

export function NetWorthChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        Add at least two monthly snapshots to see the trend.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgb(var(--surface-border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v, true)}
          width={64}
        />
        <Tooltip
          contentStyle={{
            background: "rgb(var(--surface-raised))",
            border: "1px solid rgb(var(--surface-border))",
            borderRadius: 8,
            fontSize: 13,
            color: "rgb(var(--text-primary))",
          }}
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === "liquidNetWorth" ? "Liquid net worth" : "Net worth",
          ]}
          labelFormatter={(_, payload) =>
            payload?.[0]?.payload?.date
              ? new Date(payload[0].payload.date).toLocaleDateString("en-SG", {
                  month: "long",
                  year: "numeric",
                })
              : ""
          }
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          name="netWorth"
          stroke="rgb(var(--accent))"
          strokeWidth={2}
          dot={{ fill: "rgb(var(--accent))", r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="liquidNetWorth"
          name="liquidNetWorth"
          stroke="rgb(212, 168, 75)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
