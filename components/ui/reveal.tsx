"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

import { prefersReducedMotion } from "./motion-preference";

/*
 * One-shot reveal.
 *
 * Fires once when the element first enters the viewport and then disconnects,
 * so scrolling back up never re-animates. Under prefers-reduced-motion the
 * element is marked revealed immediately and no observer is created.
 *
 * The element is visible by default in CSS terms — .reveal only lowers opacity
 * once the stylesheet loads, and the reduced-motion block resets it — so a
 * failure to hydrate can never leave content permanently invisible.
 */

export interface RevealProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly as?: ElementType;
  readonly id?: string;
  readonly "aria-labelledby"?: string;
}

export function Reveal({
  children,
  className,
  as: Component = "div",
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Fail safe toward visible: if the preference is reduce, or the runtime has
    // no IntersectionObserver, show the content immediately rather than leaving
    // it stuck at opacity 0.
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      element.dataset.revealed = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries, self) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "true");
            self.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      className={["reveal", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </Component>
  );
}
