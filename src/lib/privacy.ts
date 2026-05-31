/** Cookie read by the server (dashboard) and set by the client toggle. */
export const PRIVACY_COOKIE = "caishen-hide-amounts";

export const AMOUNT_MASK = "***";

export function isHideAmountsEnabled(
  cookieValue: string | undefined | null,
): boolean {
  return cookieValue === "1";
}
