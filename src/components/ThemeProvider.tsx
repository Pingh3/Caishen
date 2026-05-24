"use client";

import { useEffect } from "react";
import { applyDocumentTheme, themeForSingaporeHour } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => applyDocumentTheme(themeForSingaporeHour());
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
  document.documentElement.classList.remove('light','dark');
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
