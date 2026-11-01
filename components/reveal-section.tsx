"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import { prefersReducedMotion } from "./motion-preference.ts";

/** Visible by default; an observer only adds a one-time entrance animation. */
export function RevealSection(props: HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined")
      return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.classList.add("section-enter");
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <section ref={ref} {...props} />;
}
