import type { ReactNode } from "react";

import { AsciiField, type AsciiScene } from "@/components/brand/ascii-field";
import { LogosLogomark } from "@/components/brand/marks";

/*
 * The banner every top-level page opens with.
 *
 * One structure — full-bleed field, lifted title plate, scroll cue — so the
 * site feels like one place, with the ASCII variant and copy making each page
 * distinct. Content belongs below the fold: the banner states what the page is,
 * and scrolling reveals it.
 *
 * The field is decorative and aria-hidden; the h1 inside the plate carries the
 * meaning, and it is the only h1 on the page.
 */

export interface PageBannerProps {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  /** Rendered under the subtitle — usually one or two ActionLinks. */
  readonly actions?: ReactNode;
  /** Which animated scene the banner plays. */
  readonly scene?: AsciiScene;
  /** Tailwind-derived tint class, e.g. "ascii-theme-sky". */
  readonly theme?: string;
  /** Set on the h1 so the page's <section> can label itself against it. */
  readonly titleId?: string;
  /** Shorter banner for pages whose content should start sooner. */
  readonly compact?: boolean;
}

export function PageBanner({
  eyebrow,
  title,
  subtitle,
  actions,
  scene = "collapse",
  theme = "ascii-theme-violet",
  titleId = "page-title",
  compact = false,
}: PageBannerProps) {
  return (
    <section
      aria-labelledby={titleId}
      className="bleed border-border relative -mt-8 border-b sm:-mt-12"
    >
      <div
        className={`relative grid grid-cols-1 items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${
          compact ? "min-h-[46svh]" : "min-h-[68svh] lg:min-h-[76svh]"
        }`}
      >
        <div className="absolute inset-0 lg:left-[42%]">
          <AsciiField scene={scene} className={theme} />
          <div className="ascii-fallback">
            <LogosLogomark className="h-40 w-40 opacity-40" />
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="plated max-w-lg">
            <div className="panel-lifted hatched space-y-6 p-8 sm:p-10">
              <p className="eyebrow enter enter-1">{eyebrow}</p>

              <h1
                id={titleId}
                className="enter enter-2 text-4xl leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-5xl"
              >
                {title}
              </h1>

              {subtitle ? (
                <div className="enter enter-3 text-muted-foreground max-w-md leading-relaxed">
                  {subtitle}
                </div>
              ) : null}

              {actions ? (
                <div className="enter enter-4 flex flex-wrap items-center gap-3">
                  {actions}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Signals that the page continues. Decorative — the content below is
            reachable by scrolling or by tabbing straight past the banner. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center lg:flex"
        >
          <span className="eyebrow scroll-cue text-subtle-foreground">
            Scroll
          </span>
        </div>
      </div>
    </section>
  );
}
