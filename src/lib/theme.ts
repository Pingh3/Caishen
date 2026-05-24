export const THEME_TIMEZONE = "Asia/Singapore";
/** Light mode 7:00–18:59 Singapore time */
export const LIGHT_START_HOUR = 7;
export const LIGHT_END_HOUR = 19;

export function themeForSingaporeHour(date = new Date()): "light" | "dark" {
  const hour = Number(
    new Intl.DateTimeFormat("en-SG", {
      timeZone: THEME_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  return hour >= LIGHT_START_HOUR && hour < LIGHT_END_HOUR ? "light" : "dark";
}

export function applyDocumentTheme(theme: "light" | "dark"): void {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  document.documentElement.style.colorScheme = theme;
}
