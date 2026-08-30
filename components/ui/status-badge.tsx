import type { HTMLAttributes } from "react";

export type StatusBadgeVariant =
  "neutral" | "success" | "warning" | "danger" | "info";

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusBadgeVariant;
  children: string;
}

const variantStyles: Record<StatusBadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  danger: "bg-danger-surface text-danger",
  info: "bg-info-surface text-info",
};

export function StatusBadge({
  variant = "neutral",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const classes = [
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
    variantStyles[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
