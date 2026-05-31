"use client";

import { usePrivacy } from "@/components/PrivacyProvider";

export function PrivacyToggle() {
  const { hideAmounts, toggleHideAmounts } = usePrivacy();

  return (
    <button
      type="button"
      onClick={toggleHideAmounts}
      className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-raised px-2 py-0.5 text-[10px] text-muted transition hover:border-accent/40 hover:text-primary"
      title={
        hideAmounts
          ? "Show amounts (currently hidden as ***)"
          : "Hide amounts (show *** instead)"
      }
      aria-pressed={hideAmounts}
    >
      <span aria-hidden>{hideAmounts ? "◉" : "○"}</span>
      {hideAmounts ? "Amounts hidden" : "Hide amounts"}
    </button>
  );
}
