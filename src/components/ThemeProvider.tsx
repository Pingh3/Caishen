"use client";

import { useEffect } from "react";

const TZ = "Asia/Singapore";
/** Light mode 7:00–18:59 Singapore time */
const LIGHT_START = 7;
const LIGHT_END = 19;

function themeForSingaporeHour(): "light" | "dark" {
  const hour = Number(
    new Intl.DateTimeFormat("en-SG", {
      timeZone: TZ,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  return hour >= LIGHT_START && hour < LIGHT_END ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      const theme = themeForSingaporeHour();
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
      document.documentElement.style.colorScheme = theme;
    };

    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return <>{children}</>;
}

export function ThemeScript() {
  const script = `
(function(){
  var h=new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore',hour:'numeric',hour12:false});
  var hour=parseInt(h,10);
  var t=(hour>=7&&hour<19)?'light':'dark';
  document.documentElement.classList.add(t);
  document.documentElement.style.colorScheme=t;
})();
`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
