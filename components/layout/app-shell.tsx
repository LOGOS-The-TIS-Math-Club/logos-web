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
            <ul className="flex items-center gap-4 text-sm font-medium sm:gap-6">
              <li>
                <Link
                  href="/"
                  className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center px-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/#about"
                  className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center px-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/#schedule"
                  className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center px-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Schedule
                </Link>
              </li>
              <li>
                <Link
                  href="/#resources"
                  className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center px-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Resources
                </Link>
              </li>
              <li>
                <Link
                  href="/members"
                  className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center px-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Members
                </Link>
              </li>
              <li>
                <Link
                  href="/apply"
                  className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus inline-flex min-h-9 items-center justify-center px-3.5 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
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
      <footer className="border-border bg-surface text-muted-foreground border-t py-8 text-xs">
        <Container className="space-y-6">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-foreground text-sm font-semibold">
                LOGOS — The Tokyo International School Math Club
              </p>
              <p className="text-muted-foreground">
                Fridays 15:30–16:30 • Room 101 • Tokyo International School High
                School
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <Link href="/#about" className="hover:text-foreground">
                About
              </Link>
              <Link href="/#schedule" className="hover:text-foreground">
                Schedule
              </Link>
              <Link href="/#leadership" className="hover:text-foreground">
                Leadership
              </Link>
              <Link href="/#privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/#contact" className="hover:text-foreground">
                Contact
              </Link>
              <Link href="/members" className="hover:text-foreground">
                Member Hub
              </Link>
            </div>
          </div>
          <div className="border-border flex flex-col justify-between gap-2 border-t pt-4 text-[11px] sm:flex-row">
            <p>
              Student privacy protected. Application identities verified via
              Google Workspace.
            </p>
            <p>MIT License</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
