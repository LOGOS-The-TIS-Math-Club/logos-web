import { isLeadershipPath } from "../admin/navigation.ts";
import type { CurrentUser } from "./current-user.ts";

// Explicit routes prevent redirects into API endpoints, Auth callbacks or unknown pages.
const publicPages = new Set(["/", "/about", "/story", "/meetings", "/join", "/privacy", "/members"]);

export function internalDestination(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://logos.invalid");
    // Reject encoded path separators and normalization ambiguities as well.
    if (url.origin !== "https://logos.invalid" || url.pathname !== value.split(/[?#]/)[0] || /%/i.test(url.pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

export function returnDestination(value: unknown, user: CurrentUser): string | null {
  const safe = internalDestination(value);
  if (!safe) return null;
  const path = new URL(safe, "https://logos.invalid").pathname;
  if (publicPages.has(path)) return safe;
  if (path === "/apply") return safe;
  if ((user.member || user.admin) && (path === "/dashboard" || path === "/dashboard/attendance" || /^\/dashboard\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))) return safe;
  if (user.admin && isLeadershipPath(path)) return safe;
  // Unknown destinations fall back to the account panel.
  // Effective access must come from getCurrentUser, including paused/former policy.
  return null;
}

export function accountDestinations(user: CurrentUser, hasApplication: boolean | null) {
  if (user.admin) return ["Open dashboard", "Leadership controls"];
  if (user.member) return ["Open dashboard"];
  return hasApplication === null ? [] : [hasApplication ? "View application" : "Apply"];
}

export function signInLocation(code: string, intended?: string | null) {
  const query = new URLSearchParams({ notice: code });
  const safe = internalDestination(intended);
  if (safe) query.set("returnTo", safe);
  return `/auth/sign-in?${query}`;
}
