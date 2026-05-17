import type { Insight } from "@/lib/types";

const severityStyles = {
  info: "border-surface-border bg-surface/50",
  watch: "border-amber-500/40 bg-amber-500/5",
  action: "border-negative/40 bg-negative/5",
};

const severityLabel = {
  info: "Note",
  watch: "Review",
  action: "Consider",
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-raised p-5">
        <h2 className="text-sm font-medium text-primary">Insights</h2>
        <p className="mt-2 text-sm text-muted">
          No flags right now. Add snapshots and monthly expenses to unlock
          suggestions.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-5">
      <h2 className="text-sm font-medium text-primary">Insights</h2>
      <p className="mt-0.5 text-xs text-muted">
        Rules of thumb only — not financial advice.
      </p>
      <ul className="mt-4 space-y-3">
        {insights.map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-3 ${severityStyles[item.severity]}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {severityLabel[item.severity]}
            </span>
            <p className="mt-1 text-sm font-medium text-primary">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
