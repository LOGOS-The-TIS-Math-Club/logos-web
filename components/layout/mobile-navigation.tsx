"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const NAV_ITEMS = [
  { href: "/about", label: "About" },
  { href: "/story", label: "Story" },
  { href: "/meetings", label: "Meetings" },
  { href: "/join", label: "Join" },
] as const;

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="relative md:hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          setIsOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-main-navigation"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setIsOpen((open) => !open)}
        className="border-border bg-surface text-foreground hover:bg-surface-raised focus-visible:outline-focus rounded-component inline-flex min-h-11 min-w-11 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          {isOpen ? (
            <path d="m6 6 12 12M18 6 6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      <ul
        id="mobile-main-navigation"
        aria-label="Section navigation"
        hidden={!isOpen}
        className="panel absolute top-full right-0 z-50 mt-2 grid w-52 gap-1 p-2 shadow-lg"
      >
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="hover:bg-surface-raised focus-visible:outline-focus rounded-component flex min-h-11 items-center px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
