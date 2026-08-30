import type { AnchorHTMLAttributes, ReactNode } from "react";

export interface SkipLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  children?: ReactNode;
}

export function SkipLink({
  href = "#main-content",
  children = "Skip to main content",
  className,
  ...props
}: SkipLinkProps) {
  const classes = [
    "fixed top-4 left-4 z-50 -translate-y-24 rounded-component border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-transform duration-150 focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a href={href} className={classes} {...props}>
      {children}
    </a>
  );
}
