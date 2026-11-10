"use client";
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "../action.tsx";
export function DraftGuard({ dirty, subject = "absence draft" }: { dirty: boolean; subject?: string }) {
  const [destination, setDestination] = useState<string | null>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const leaving = useRef(false);
  useEffect(() => {
    if (destination) keep.current?.focus();
  }, [destination]);
  useEffect(() => {
    if (!dirty) return;
    const ask = (url: string) => {
      previous.current = document.activeElement as HTMLElement;
      setDestination(url);
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (!leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        leaving.current ||
        !anchor ||
        event.ctrlKey ||
        event.metaKey ||
        anchor.target === "_blank" ||
        (anchor.pathname === location.pathname &&
          anchor.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      ask(anchor.href);
    };
    const traverse = (event: Event) => {
      const navigation = event as Event & {
        navigationType?: string;
        destination?: { url: string };
      };
      if (
        !leaving.current &&
        event.cancelable &&
        navigation.navigationType === "traverse" &&
        navigation.destination
      ) {
        event.preventDefault();
        ask(navigation.destination.url);
      }
    };
    const navigation = (window as unknown as { navigation?: EventTarget })
      .navigation;
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", traverse);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", traverse);
    };
  }, [dirty]);
  const cancel = () => {
    setDestination(null);
    previous.current?.focus();
  };
  return destination ? (
    <div className="application-modal-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-draft-heading"
        className="home-panel dashboard-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
          if (event.key === "Tab") {
            const buttons =
              event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2 id="notice-draft-heading">Leave this {subject}?</h2>
        <p>
          Your unsaved entries stay on this page only. Check an uncertain
          submission before leaving.
        </p>
        <div className="dashboard-actions">
          <ActionButton ref={keep} onClick={cancel}>
            Keep editing
          </ActionButton>
          <ActionButton
            variant="danger"
            onClick={() => {
              leaving.current = true;
              location.assign(destination);
            }}
          >
            Leave without saving
          </ActionButton>
        </div>
      </div>
    </div>
  ) : null;
}
