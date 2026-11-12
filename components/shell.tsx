"use client";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation.js";
import { ActionLink } from "./action.tsx";
import { LogosLockup, LogosLogomark } from "./marks.tsx";
import { MotionControl, MotionProvider } from "./motion-control.tsx";
import type { AccountState } from "../src/auth/account-state.ts";
import { accountHeaderLinks } from "../src/auth/navigation.ts";
const links = [
  { href: "/about", label: "About" },
  { href: "/story", label: "Story" },
  { href: "/meetings", label: "Meetings" },
  { href: "/join", label: "Join" },
  { href: "/privacy", label: "Privacy" },
  { href: "/members", label: "Members" },
];
export function Shell({
  children,
  motion,
}: {
  children: ReactNode;
  motion: "on" | "off";
}) {
  const [open, setOpen] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountState["status"] | null>(null);
  useEffect(() => {
    let pending: AbortController | undefined;
    async function refreshAccount() {
      pending?.abort();
      const request = new AbortController();
      pending = request;
      try {
        const response = await fetch("/api/account", {
          cache: "no-store",
          credentials: "same-origin",
          signal: request.signal,
        });
        if (!response.ok) throw new Error("Account check failed");
        const result: { data: AccountState } = await response.json();
        if (!request.signal.aborted) setAccountStatus(result.data.status);
      } catch {
        if (!request.signal.aborted) setAccountStatus("unavailable");
      }
    }
    void refreshAccount();
    window.addEventListener("focus", refreshAccount);
    window.addEventListener("pageshow", refreshAccount);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", refreshAccount);
      window.removeEventListener("pageshow", refreshAccount);
    };
  }, []);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const content = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const element = content.current;
    if (!element?.animate || document.documentElement.dataset.motion === "off") return;
    // Animate the committed destination without delaying routing or remounting it.
    // Opacity leaves fixed drawers, focus, and scroll positioning untouched.
    const entrance = element.animate([{ opacity: 0.84 }, { opacity: 1 }], {
      duration: 150,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
    const preference = new MutationObserver(() => {
      if (document.documentElement.dataset.motion === "off") entrance.cancel();
    });
    preference.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    void entrance.finished.then(() => preference.disconnect(), () => preference.disconnect());
    return () => { preference.disconnect(); entrance.cancel(); };
  }, [pathname]);
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
    <MotionProvider motion={motion}>
    <div className="shell" onDragStart={(event) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) event.preventDefault();
    }}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header>
        <div className="container header-inner">
          <Link
            href="/"
            className="brand"
            aria-label="LOGOS home"
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
            {accountStatus && accountHeaderLinks(accountStatus).map(({ label, href }) => (
              <ActionLink
                key={href}
                variant={label === "Apply" ? "primary" : undefined}
                className="action-sm"
                href={href}
                onClick={() => setOpen(false)}
              >
                {label}
              </ActionLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <div ref={content} className="container page-content">{children}</div>
      </main>
      <footer>
        <div className="container">
          <div className="footer-main">
            <div className="footer-brand">
              <LogosLockup aria-hidden="true" />
              <p className="sr-only">
                LOGOS, Tokyo International School Math Club
              </p>
              <p>
                The student-led mathematics club of Tokyo International School.
              </p>
            </div>
            <nav aria-label="Footer navigation">
              <ul>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            {!['/', '/about', '/join', '/meetings', '/story'].includes(pathname) ? <MotionControl /> : null}
          </div>
          <div className="footer-bottom">
            <p>Tokyo International School · Grades 9-12</p>
            <a href="mailto:mathclub@tokyois.com">mathclub@tokyois.com</a>
            <p>MIT License</p>
          </div>
        </div>
      </footer>
    </div>
    </MotionProvider>
  );
}
