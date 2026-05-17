type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "negative";
};

export function StatCard({ label, value, sub, tone = "default" }: StatCardProps) {
  const valueClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : "text-primary";

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-sm text-secondary">{sub}</p> : null}
    </div>
  );
}
