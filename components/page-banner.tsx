import type { ReactNode } from "react";
import { AsciiField, type AsciiScene } from "./brand/ascii-field.tsx";
import { LogosLogomark } from "./marks.tsx";
import { MotionControl } from "./motion-control.tsx";

export function PageBanner({
  eyebrow,
  title,
  subtitle,
  actions,
  scene,
  theme,
  titleId,
  className = "",
  waveSurface = false,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  actions: ReactNode;
  scene: AsciiScene;
  theme: string;
  titleId: string;
  className?: string;
  waveSurface?: boolean;
}) {
  return (
    <section
      className={`home-banner ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div className="hero-field">
        <AsciiField scene={scene} className={theme} waveSurface={waveSurface} />
        <div className="ascii-fallback" aria-hidden="true">
          <LogosLogomark />
        </div>
      </div>
      <div className="hero-motion-control"><MotionControl /></div>
      <div className="hero-content">
        <div className="plated hero-plate">
          <div className="home-panel hatched">
            <p className="eyebrow enter enter-1">{eyebrow}</p>
            <h1 id={titleId} className="enter enter-2">
              {title}
            </h1>
            <p className="muted enter enter-3">{subtitle}</p>
            <div className="home-actions enter enter-4">{actions}</div>
          </div>
        </div>
      </div>
      <span className="scroll-cue eyebrow" aria-hidden="true">
        Scroll ↓
      </span>
    </section>
  );
}
