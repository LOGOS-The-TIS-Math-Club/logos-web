/**
 * Reduced-motion detection that tolerates environments without matchMedia.
 *
 * jsdom and some embedded webviews do not implement window.matchMedia. Calling
 * it unguarded throws during effect mount and takes the whole page down, so
 * every motion component goes through here.
 *
 * Note the CSS in globals.css enforces prefers-reduced-motion independently, so
 * a runtime that cannot report the preference still gets the transition reset.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

export function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function") return null;
  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined") {
    const preference = document.documentElement.dataset.motion;
    if (preference === "on") return false;
    if (preference === "off") return true;
  }
  return reducedMotionQuery()?.matches ?? false;
}
