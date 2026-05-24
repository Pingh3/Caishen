"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  formatBreakdownAmount,
} from "@/lib/dashboard-breakdown";
import {
  formatCurrency,
  formatPercent,
  formatTradePrice,
  formatUsd,
} from "@/lib/finance";
import { PRIVACY_COOKIE } from "@/lib/privacy";

type PrivacyContextValue = {
  hideAmounts: boolean;
  setHideAmounts: (hide: boolean) => void;
  toggleHideAmounts: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

function writePrivacyCookie(hide: boolean) {
  const value = hide ? "1" : "0";
  document.cookie = `${PRIVACY_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  try {
    localStorage.setItem(PRIVACY_COOKIE, value);
  } catch {
    /* ignore */
  }
}

export function PrivacyProvider({
  children,
  initialHide,
}: {
  children: ReactNode;
  initialHide: boolean;
}) {
  const router = useRouter();
  const [hideAmounts, setHideAmountsState] = useState(initialHide);

  const setHideAmounts = useCallback(
    (hide: boolean) => {
      setHideAmountsState(hide);
      writePrivacyCookie(hide);
      router.refresh();
    },
    [router],
  );

  const toggleHideAmounts = useCallback(() => {
    setHideAmounts(!hideAmounts);
  }, [hideAmounts, setHideAmounts]);

  const value = useMemo(
    () => ({ hideAmounts, setHideAmounts, toggleHideAmounts }),
    [hideAmounts, setHideAmounts, toggleHideAmounts],
  );

  return (
    <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    throw new Error("usePrivacy must be used within PrivacyProvider");
  }
  return ctx;
}

/** Formatters that respect the hide-amounts toggle (client pages). */
export function useAmountFormatters() {
  const { hideAmounts: hide } = usePrivacy();
  return useMemo(
    () => ({
      currency: (n: number, compact?: boolean) => formatCurrency(n, compact, hide),
      percent: (n: number, signed?: boolean) =>
        formatPercent(n, signed ?? false, hide),
      usd: (n: number) => formatUsd(n, hide),
      tradePrice: (n: number, market: "US" | "SG" | "HK") =>
        formatTradePrice(n, market, hide),
      breakdown: (n: number) => formatBreakdownAmount(n, hide),
    }),
    [hide],
  );
}
