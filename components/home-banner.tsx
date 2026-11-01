import { AsciiField } from "./brand/ascii-field.tsx";
import { LogosLogomark } from "./marks.tsx";
import { ActionLink } from "./action.tsx";

export function HomeBanner() {
  return (
    <section className="home-banner" aria-labelledby="hero-heading">
      <div className="hero-field">
        <AsciiField scene="collapse" className="ascii-theme-violet" />
        <div className="ascii-fallback" aria-hidden="true">
          <LogosLogomark />
        </div>
      </div>
      <div className="hero-content">
        <div className="plated hero-plate">
          <div className="home-panel hatched">
            <p className="eyebrow enter enter-1">
              Tokyo International School · Grades 9–12
            </p>
            <h1 id="hero-heading" className="enter enter-2">
              Mathematics,
              <br />
              taken seriously.
            </h1>
            <p className="muted enter enter-3">
              The student-led mathematics club of Tokyo International School.
            </p>
            <div className="home-actions enter enter-4">
              <ActionLink href="/apply" variant="primary">
                Apply to LOGOS
              </ActionLink>
              <ActionLink href="/about">About the club</ActionLink>
            </div>
          </div>
        </div>
      </div>
      <span className="scroll-cue eyebrow" aria-hidden="true">
        Scroll ↓
      </span>
    </section>
  );
}
