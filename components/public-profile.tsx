"use client";

import { useId, useRef, useState, type MouseEvent } from "react";
import { ContentImage } from "./content-image.tsx";
import { DashboardIcon } from "./dashboard/icon.tsx";
import { useMotionEnabled } from "./motion-control.tsx";

export function PublicProfile({ name, status, imageId, biography }: {
  name: string;
  status: string;
  imageId: string | null;
  biography: string;
}) {
  const titleId = useId();
  const initials = name.trim().split(/\s+/u).slice(0, 2).map((part) => Array.from(part)[0]).join("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const motionEnabled = useMotionEnabled();

  function openProfile() {
    const dialog = dialogRef.current;
    const card = triggerRef.current?.closest("li");
    if (!dialog || dialog.open) return;

    const origin = card?.getBoundingClientRect();
    dialog.showModal();
    setIsOpen(true);
    if (!origin || !motionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const center = dialog.getBoundingClientRect();
    const x = origin.left + origin.width / 2 - center.left - center.width / 2;
    const y = origin.top + origin.height / 2 - center.top - center.height / 2;
    const scale = Math.max(.6, Math.min(.9, origin.width / center.width));
    dialog.getAnimations().forEach((animation) => animation.cancel());
    dialog.animate(
      [
        { transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`, opacity: 0 },
        {
          transform: `translate3d(${x * .25}px, ${y * .25}px, 0) scale(${1 - (1 - scale) * .25})`,
          opacity: .92,
          offset: .45,
          easing: "cubic-bezier(.18, .55, .35, 1)",
        },
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 360, easing: "cubic-bezier(.22, .65, .32, 1)" },
    );
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }

  function portrait(priority = false) {
    return (
      <div className="person-portrait">
        {imageId ? (
          <ContentImage id={imageId} alt={`Portrait of ${name}`} width={null} height={null}
            priority={priority} unavailableMessage="Profile image unavailable." />
        ) : <span className="person-monogram" aria-hidden="true">{initials}</span>}
      </div>
    );
  }

  return (
    <li className="person-card plated">
      <p className="eyebrow person-status">{status}</p>
      <h3 className="person-name">
        <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={openProfile}>
          {name}
          <span className="person-open-icon"><DashboardIcon name="arrow" /></span>
        </button>
      </h3>
      {portrait()}
      <dialog ref={dialogRef} className="person-dialog" aria-labelledby={titleId}
        onClick={closeFromBackdrop} onClose={() => {
          setIsOpen(false);
          triggerRef.current?.focus();
        }}>
        <div className="person-dialog-content">
          <button type="button" className="person-dialog-close" aria-label="Close profile" autoFocus
            onClick={() => dialogRef.current?.close()}><DashboardIcon name="close" /></button>
          <div className="person-dialog-heading">
            <p className="eyebrow">{status}</p>
            <h2 id={titleId}>{name}</h2>
          </div>
          <div className="person-dialog-portrait">{isOpen ? portrait(true) : null}</div>
          {biography.trim() ? <p className="muted person-biography">{biography}</p> : null}
        </div>
      </dialog>
    </li>
  );
}
