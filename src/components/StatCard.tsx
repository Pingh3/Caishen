import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "default" | "positive" | "negative";
  active?: boolean;
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  active = false,
  onClick,
}: StatCardProps) {
  const valueClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : "text-primary";

  const className = `w-full rounded-xl border p-4 text-left transition ${
    active
      ? "border-accent bg-accent/10 ring-1 ring-accent/30"
      : "border-surface-border bg-surface-raised hover:border-accent/40"
  }`;

  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {onClick ? (
          <span className="ml-1 font-normal normal-case text-accent">
            · tap for breakdown
          </span>
        ) : null}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      {sub ? <div className="mt-1 text-sm text-secondary">{sub}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
