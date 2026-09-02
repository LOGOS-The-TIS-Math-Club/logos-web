import type { ReactNode } from "react";
import Link from "next/link";

import { LogosLockup, LogosLogomark } from "@/components/brand/marks";
import { CONTACT_EMAIL } from "@/content/club";
import { ActionLink } from "@/components/ui/action";

import { Container } from "./container";
import { SkipLink } from "./skip-link";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

const NAV_ITEMS = [
  { href: "/about", label: "About" },
  { href: "/meetings", label: "Meetings" },
  { href: "/join", label: "Join" },
] as const;

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/meetings", label: "Meetings" },
  { href: "/join", label: "Join" },
  { href: "/privacy", label: "Privacy" },
  { href: "/members", label: "Members" },
] as const;

export function AppShell({ children, className }: AppShellProps) {
  const mainClasses = ["flex-1 focus:outline-none", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="bg-background text-foreground flex min-h-[100dvh] flex-col overflow-x-clip">
      <SkipLink />

      <header className="border-border bg-surface/95 sticky top-0 z-50 border-b">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="LOGOS — home"
            className="rounded-component text-foreground hover:text-primary focus-visible:outline-focus inline-flex min-h-11 items-center px-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
          >
            <LogosLockup
              aria-hidden="true"
              className="hidden h-6 w-auto sm:block"
            />
            <LogosLogomark aria-hidden="true" className="h-7 w-7 sm:hidden" />
          </Link>

          <nav aria-label="Main navigation" className="flex items-center gap-1">
            <ul className="mr-2 hidden items-center gap-5 text-sm md:flex">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  {/* Two stacked copies of the label: on hover the pair
                      rolls up so the second replaces the first. */}
                  <Link
                    href={item.href}
                    className="nav-item focus-visible:outline-focus inline-flex h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span className="nav-item-roll" aria-hidden="true">
                      <span>{item.label}</span>
                      <span>{item.label}</span>
                    </span>
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ActionLink href="/apply" variant="primary" className="action-sm">
              Apply
            </ActionLink>
          </nav>
        </Container>
      </header>

      {/*
        The container stays here so every existing page (apply, members, auth,
        admin) keeps its layout unchanged. Sections that need the full viewport
        width opt out with the `.bleed` utility rather than the shell changing.
      */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`${mainClasses} overflow-x-clip`}
      >
        <Container className="py-8 sm:py-12">{children}</Container>
      </main>

      <footer className="border-border bg-surface hatched border-t">
        <Container className="space-y-10 py-14">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-5">
              <LogosLockup
                aria-hidden="true"
                className="text-muted-foreground h-7 w-auto"
              />
              {/* The lockup is decorative, so the organisation name is carried
                  here for assistive technology and document semantics. */}
              <p className="sr-only">
                LOGOS — The Tokyo International School Math Club
              </p>
              <p className="text-muted-foreground max-w-sm text-sm">
                The student-led mathematics club of Tokyo International School.
              </p>
              <dl className="datum text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="sr-only">Day</dt>
                  <dd className="text-foreground">Fridays</dd>
                </div>
                <span aria-hidden="true">·</span>
                <div className="flex gap-2">
                  <dt className="sr-only">Time</dt>
                  <dd className="text-foreground">15:30–16:30</dd>
                </div>
                <span aria-hidden="true">·</span>
                <div className="flex gap-2">
                  <dt className="sr-only">Location</dt>
                  <dd className="text-foreground">Room 101</dd>
                </div>
              </dl>
            </div>

            <nav aria-label="Footer navigation">
              <ul className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-2">
                {FOOTER_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="border-border text-subtle-foreground flex flex-col justify-between gap-2 border-t pt-6 text-xs sm:flex-row">
            <p>
              Applications are identified with a verified Tokyo International
              School Google account.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="link-underline datum"
            >
              {CONTACT_EMAIL}
            </a>
            <p>MIT License</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
