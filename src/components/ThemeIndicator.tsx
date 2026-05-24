"use client";

import { useEffect, useState } from "react";
import { themeForSingaporeHour } from "@/lib/theme";

export function ThemeIndicator() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const apply = () => setTheme(themeForSingaporeHour());
    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const label = theme === "light" ? "Day mode" : "Night mode";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-raised px-2 py-0.5 text-[10px] text-muted"
      title={`${label} · Singapore time (7am–7pm light)`}
    >
      <span aria-hidden>{theme === "light" ? "☀" : "☾"}</span>
      {label}
    </span>
  );
}
