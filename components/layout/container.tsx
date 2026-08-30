import type { HTMLAttributes } from "react";

export type ContainerProps = HTMLAttributes<HTMLDivElement>;

export function Container({ className, children, ...props }: ContainerProps) {
  const classes = ["mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
