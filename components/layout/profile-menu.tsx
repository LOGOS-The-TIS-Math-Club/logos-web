"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { SignOutButton } from "@/app/auth/auth-controls";
import type { Viewer } from "@/lib/auth/viewer.server";

/*
 * The signed-in control in the header.
 *
 * Closed, it is only the avatar — the address is private and does not belong on
 * screen in a classroom or on a shared projector. Opening it is a deliberate act
 * by the person it belongs to, and only then is the address shown.
 *
 * A disclosure, not an ARIA menu: these are ordinary links, and the menu role
 * would promise arrow-key semantics this does not implement.
 */

export function ProfileMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = viewer.email.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        className="border-border hover:border-primary focus-visible:outline-focus flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
      >
        {viewer.avatarUrl ? (
          <Image
            src={viewer.avatarUrl}
            alt=""
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-surface-raised text-foreground flex h-full w-full items-center justify-center text-sm font-semibold"
          >
            {initial}
          </span>
        )}
        <span className="sr-only">Your account</span>
      </button>

      {open ? (
        <div id={panelId} className="absolute right-0 z-50 mt-2 w-64">
          <div className="panel-lifted p-2">
            <p className="text-subtle-foreground truncate px-3 pt-2 pb-1 text-xs">
              Signed in as
            </p>
            <p className="datum text-foreground truncate px-3 pb-3 text-xs">
              {viewer.email}
            </p>

            <div className="border-border space-y-1 border-t pt-2">
              {viewer.isMember ? (
                <>
                  <MenuLink href="/members" onNavigate={() => setOpen(false)}>
                    Dashboard
                  </MenuLink>
                  <MenuLink
                    href="/members#absence"
                    onNavigate={() => setOpen(false)}
                  >
                    Excuse an absence
                  </MenuLink>
                </>
              ) : (
                <MenuLink href="/auth/status" onNavigate={() => setOpen(false)}>
                  Account status
                </MenuLink>
              )}

              {viewer.isLeadership ? (
                <MenuLink href="/admin" onNavigate={() => setOpen(false)}>
                  Leadership tools
                </MenuLink>
              ) : null}
            </div>

            <div className="border-border mt-2 border-t pt-2">
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:outline-focus block px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 motion-reduce:transition-none"
    >
      {children}
    </Link>
  );
}
