import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import Link from "next/link";

/*
 * The signature LOGOS control.
 *
 * A duplicate label, colour-inverted, is clipped to a diagonal and wiped across
 * the control on hover. The press state is a one-pixel nudge; nothing scales.
 * All of it is CSS (see .action in globals.css); this component only supplies
 * the two label layers the effect needs.
 */

export type ActionVariant = "primary" | "outline" | "quiet" | "danger";

const variantClass: Record<ActionVariant, string> = {
  primary: "action-primary",
  outline: "",
  quiet: "action-quiet",
  danger: "action-danger",
};

function classes(variant: ActionVariant, className?: string) {
  return ["action", variantClass[variant], className].filter(Boolean).join(" ");
}

/**
 * Both layers must render identical content: the hover layer is the same label
 * revealed through a moving clip, not a different message.
 */
function Layers({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="action-label">{children}</span>
      <span className="action-label-hover" aria-hidden="true">
        {children}
      </span>
    </>
  );
}

export interface ActionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string;
  readonly variant?: ActionVariant;
  readonly children: ReactNode;
}

export function ActionButton({ variant = "outline", className, children, type = "button", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ActionVariant; ref?: Ref<HTMLButtonElement> }) {
  return <button type={type} className={classes(variant, className)} {...props}><Layers>{children}</Layers></button>;
}

export function ActionLink({
  href,
  variant = "outline",
  className,
  children,
  ...props
}: ActionLinkProps) {
  const isInternal = href.startsWith("/") && !href.startsWith("//");

  if (isInternal) {
    return (
      <Link href={href} className={classes(variant, className)} {...props}>
        <Layers>{children}</Layers>
      </Link>
    );
  }

  return (
    <a href={href} className={classes(variant, className)} {...props}>
      <Layers>{children}</Layers>
    </a>
  );
}
