import type { ReactNode } from "react";

/*
 * The eyebrow + heading + lede block that opens almost every section.
 *
 * It existed as a hand-copied cluster of Tailwind classes in fourteen places,
 * which is how a design drifts out of alignment. Naming it means a change to
 * section rhythm happens once.
 *
 * `as` exists because heading level is a document-structure decision, not a
 * visual one: a section inside a page whose h1 lives in the banner needs an
 * h2, while a panel inside that section may need an h3. Size is chosen
 * separately via `size`, so the two never get conflated.
 */

export interface SectionHeadingProps {
  readonly eyebrow?: string;
  readonly title: ReactNode;
  readonly lede?: ReactNode;
  readonly as?: "h1" | "h2" | "h3";
  readonly size?: "display" | "heading-1" | "heading-2";
  readonly id?: string;
  readonly className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  as: Tag = "h2",
  size = "heading-1",
  id,
  className,
}: SectionHeadingProps) {
  return (
    <div className={["space-y-3", className].filter(Boolean).join(" ")}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <Tag id={id} className={size}>
        {title}
      </Tag>
      {lede ? <p className="lede">{lede}</p> : null}
    </div>
  );
}
