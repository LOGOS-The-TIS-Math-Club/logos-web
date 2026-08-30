import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground hover:bg-surface active:bg-surface-raised",
  outline:
    "border-border bg-transparent text-foreground hover:bg-surface active:bg-surface-raised",
  ghost:
    "border-transparent bg-transparent text-foreground hover:bg-surface active:bg-surface-raised",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-2 text-xs",
  md: "min-h-11 px-4 py-2.5 text-sm",
  lg: "min-h-11 px-6 py-3 text-base",
};

export function Button({
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center rounded-component border font-medium whitespace-nowrap cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} disabled={disabled} className={classes} {...props}>
      {children}
    </button>
  );
}
