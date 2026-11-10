"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native keyboard behavior, with a reversible height transition after hydration. */
export function Disclosure({
  summary,
  children,
  className = "",
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const animation = useRef<Animation | null>(null);
  const expanded = useRef(defaultOpen);
  useEffect(() => {
    const element = details.current;
    if (!element) return;
    expanded.current = defaultOpen;
    element.open = defaultOpen;
    element.dataset.expanded = String(defaultOpen);
    const motion = new MutationObserver(() => {
      if (document.documentElement.dataset.motion === "off")
        animation.current?.finish();
    });
    motion.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    return () => {
      motion.disconnect();
      animation.current?.cancel();
    };
  }, [defaultOpen]);

  return (
    <details
      ref={details}
      open={defaultOpen}
      className={`inline-disclosure ${className}`}
    >
      <summary
        onClick={(event) => {
          const element = details.current;
          if (!element) return;
          event.preventDefault();
          const start = element.getBoundingClientRect().height;
          animation.current?.cancel();
          expanded.current = !expanded.current;
          const next = expanded.current;
          element.dataset.expanded = String(next);
          const style = getComputedStyle(element);
          const heading =
            event.currentTarget.getBoundingClientRect().height +
            parseFloat(style.paddingTop) +
            parseFloat(style.paddingBottom) +
            parseFloat(style.borderTopWidth) +
            parseFloat(style.borderBottomWidth);
          element.open = true;
          const end = next ? element.getBoundingClientRect().height : heading;
          if (
            document.documentElement.dataset.motion === "off" ||
            !element.animate
          ) {
            element.open = next;
            return;
          }
          const transition = element.animate(
            [{ height: `${start}px` }, { height: `${end}px` }],
            {
              duration: 200,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
          );
          animation.current = transition;
          transition.onfinish = () => {
            element.open = next;
            animation.current = null;
          };
        }}
      >
        <svg
          className="disclosure-chevron"
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 3 6 5-6 5" />
        </svg>
        <span className="disclosure-label">{summary}</span>
      </summary>
      <div className="disclosure-content">{children}</div>
    </details>
  );
}
