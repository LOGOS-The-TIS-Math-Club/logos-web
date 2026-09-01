import type { ReactNode } from "react";
import Link from "next/link";

import { Container } from "./container";
import { SkipLink } from "./skip-link";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  const mainClasses = ["flex-1 focus:outline-none", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="bg-background text-foreground flex min-h-[100dvh] flex-col">
      <SkipLink />
      <header className="border-border bg-surface border-b">
        <Container className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="rounded-component text-foreground hover:text-primary focus-visible:outline-focus inline-flex min-h-11 items-center px-2 text-base font-semibold tracking-tight transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            LOGOS
          </Link>
          <nav aria-label="Main navigation">
            <ul className="flex items-center gap-6">
              <li>
                <Link
                  href="/"
                  className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center px-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/apply"
                  className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center px-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Apply
                </Link>
              </li>
            </ul>
          </nav>
        </Container>
      </header>
      <main id="main-content" tabIndex={-1} className={mainClasses}>
        <Container className="py-8 sm:py-12">{children}</Container>
      </main>
      <footer className="border-border bg-surface text-muted-foreground border-t py-6 text-sm">
        <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p>The Tokyo International School Math Club</p>
          <p>MIT License</p>
        </Container>
      </footer>
    </div>
  );
}
