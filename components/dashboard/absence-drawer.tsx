"use client";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { DashboardIcon } from "./icon.tsx";

export function AbsenceDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) {
      if (element.open) element.close();
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    close.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (element.open) element.close();
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="dashboard-drawer"
      aria-labelledby="absence-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="dashboard-drawer-toolbar">
        <span className="eyebrow">LOGOS / MEMBERS</span>
        <button
          ref={close}
          type="button"
          className="dashboard-icon-button"
          aria-label="Close absence form"
          onClick={onClose}
        >
          <DashboardIcon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
