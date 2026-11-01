"use client";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation.js";
import { ActionLink } from "./action.tsx";
import { LogosLockup, LogosLogomark } from "./marks.tsx";
const links = [
  { href: "/about", label: "About" },
  { href: "/story", label: "Story" },
  { href: "/meetings", label: "Meetings" },
  { href: "/join", label: "Join" },
];
export function Shell({
  children,
  motion,
}: {
  children: ReactNode;
  motion: "on" | "off";
}) {
  const [open, setOpen] = useState(false);
  const [animations, setAnimations] = useState(motion === "on");
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  function changeMotion() {
    const next = animations ? "off" : "on";
    document.cookie = `logos_motion=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.dataset.motion = next;
    setAnimations(!animations);
  }
  function navigation() {
    return links.map((link) => (
      <li key={link.href}>
        <Link
          href={link.href}
          aria-current={pathname === link.href ? "page" : undefined}
          onClick={() => setOpen(false)}
          className="nav-link"
        >
          <span className="nav-roll" aria-hidden="true">
            <span>{link.label}</span>
            <span>{link.label}</span>
          </span>
          <span className="sr-only">{link.label}</span>
        </Link>
      </li>
    ));
  }
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header>
        <div className="container header-inner">
          <Link
            href="/"
            className="brand"
            aria-label="LOGOS — home"
            onClick={() => setOpen(false)}
          >
            <span className="action-label" aria-hidden="true">
              <LogosLockup className="lockup" />
              <LogosLogomark className="mobile-mark" />
            </span>
            <span className="action-label-hover" aria-hidden="true">
              <LogosLockup className="lockup" />
              <LogosLogomark className="mobile-mark" />
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            onKeyDown={(e) => {
              if (e.key === "Escape" && open) {
                setOpen(false);
                toggle.current?.focus();
              }
            }}
          >
            <ul className="desktop-nav">{navigation()}</ul>
            <div className="mobile-nav">
              <button
                ref={toggle}
                className="menu-button"
                aria-expanded={open}
                aria-controls="mobile-navigation"
                aria-label={
                  open ? "Close navigation menu" : "Open navigation menu"
                }
                onClick={() => setOpen(!open)}
              >
                {open ? "×" : "☰"}
              </button>
              <ul id="mobile-navigation" hidden={!open}>
                {navigation()}
              </ul>
            </div>
            <ActionLink
              variant="primary"
              className="action-sm"
              href="/apply"
              onClick={() => setOpen(false)}
            >
              Apply
            </ActionLink>
            <ActionLink
              className="action-sm"
              href="/auth/sign-in"
              onClick={() => setOpen(false)}
            >
              Sign in
            </ActionLink>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <div className="container page-content">{children}</div>
      </main>
      <footer>
        <div className="container">
          <div className="footer-main">
            <div className="footer-brand">
              <LogosLockup aria-hidden="true" />
              <p className="sr-only">
                LOGOS — Tokyo International School Math Club
              </p>
              <p>
                The student-led mathematics club of Tokyo International School.
              </p>
            </div>
            <nav aria-label="Footer navigation">
              <ul>
                {[
                  ...links,
                  { href: "/privacy", label: "Privacy" },
                  { href: "/members", label: "Members" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <button
              className="motion-toggle"
              onClick={changeMotion}
              aria-pressed={animations}
            >
              {animations ? "Disable animations" : "Enable animations"}
            </button>
          </div>
          <div className="footer-bottom">
            <p>Tokyo International School · Grades 9–12</p>
            <a href="mailto:mathclub@tokyois.com">mathclub@tokyois.com</a>
            <p>MIT License</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
