import type { ReactNode } from "react";

import { SectionHeading } from "./section-heading";

/*
 * The frame for signed-in and administrative pages.
 *
 * The public site got a designed shell while the member and leadership areas
 * kept an older, ad-hoc one — which is the single clearest way a product reads
 * as unfinished. This gives those pages one consistent title block, measure and
 * rhythm without borrowing the marketing banner, which would be wrong here:
 * these are tools, and they should open straight into the work.
 */

export interface AppPageProps {
  readonly eyebrow?: string;
  readonly title: ReactNode;
  readonly lede?: ReactNode;
  /** Actions aligned with the title, e.g. an export button. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  /** Narrower measure for form-led pages. */
  readonly width?: "default" | "narrow";
}

export function AppPage({
  eyebrow,
  title,
  lede,
  actions,
  children,
  width = "default",
}: AppPageProps) {
  return (
    <div
      className={`mx-auto w-full space-y-10 py-2 ${
        width === "narrow" ? "max-w-2xl" : "max-w-5xl"
      }`}
    >
      <header className="border-border flex flex-wrap items-end justify-between gap-6 border-b pb-6">
        <SectionHeading
          as="h1"
          size="heading-1"
          eyebrow={eyebrow}
          title={title}
          lede={lede}
        />
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </header>

      {children}
    </div>
  );
}
