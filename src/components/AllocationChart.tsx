"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { usePrivacy } from "@/components/PrivacyProvider";
import { formatCurrency } from "@/lib/finance";
import type { AccountCategory } from "@/lib/types";

const COLORS: Record<AccountCategory, string> = {
  cash: "#34d399",
  investments: "#3d9cf0",
  retirement: "#a78bfa",
  property: "#fbbf24",
  other_asset: "#f472b6",
  liability: "#ef4444",
};

type Slice = { category: AccountCategory; value: number; name: string };

export function AllocationChart({ slices }: { slices: Slice[] }) {
  const { hideAmounts } = usePrivacy();

  if (slices.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        No asset data in the latest snapshot.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={96}
          paddingAngle={2}
        >
          {slices.map((entry) => (
            <Cell key={entry.category} fill={COLORS[entry.category]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "rgb(var(--surface-raised))",
            border: "1px solid rgb(var(--surface-border))",
            borderRadius: 8,
            fontSize: 13,
            color: "rgb(var(--text-primary))",
          }}
          formatter={(value: number, name: string) => [
            formatCurrency(value, false, hideAmounts),
            name,
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
