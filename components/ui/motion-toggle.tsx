"use client";

import { useEffect, useState } from "react";

import { prefersReducedMotion, reducedMotionQuery } from "./motion-preference";

/** Lets visitors opt in to site animation when their browser reduces motion. */
export function MotionToggle() {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setReduced(prefersReducedMotion());
    const query = reducedMotionQuery();
    update();
    query?.addEventListener("change", update);
    return () => query?.removeEventListener("change", update);
  }, []);

  function toggle() {
    const value = reduced ? "on" : "off";
    document.cookie = `logos_motion=${value}; Path=/; Max-Age=31536000; SameSite=Lax${
      location.protocol === "https:" ? "; Secure" : ""
    }`;
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={reduced === null}
      aria-label={
        reduced === null
          ? "Change animation preference"
          : reduced
            ? "Enable animations"
            : "Disable animations"
      }
      className="text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {reduced === null
        ? "Animation preference"
        : reduced
          ? "Enable animations"
          : "Disable animations"}
    </button>
  );
}
