"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const MotionContext = createContext<{
  enabled: boolean;
  toggle: () => void;
} | null>(null);

export function useMotionEnabled() {
  return useContext(MotionContext)?.enabled ?? false;
}

export function MotionProvider({ motion, children }: {
  motion: "on" | "off";
  children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(motion === "on");
  function toggle() {
    const next = enabled ? "off" : "on";
    document.cookie = `logos_motion=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.dataset.motion = next;
    setEnabled(!enabled);
  }
  return <MotionContext.Provider value={{ enabled, toggle }}>{children}</MotionContext.Provider>;
}

export function MotionControl() {
  const preference = useContext(MotionContext);
  if (!preference) throw new Error("MotionControl requires MotionProvider");
  return (
    <button type="button" className="motion-toggle" onClick={preference.toggle}>
      {preference.enabled ? "Disable animations" : "Enable animations"}
    </button>
  );
}
