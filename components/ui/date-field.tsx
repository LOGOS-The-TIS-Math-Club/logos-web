"use client";

import { useEffect, useId, useRef, useState } from "react";

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DateField({
  id,
  label,
  value,
  onChange,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parseDate(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupId = useId();
  const selected = parseDate(value);
  const selectedLabel = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(selected);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const firstDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  );
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const days = Array.from(
    { length: firstDay.getDay() + daysInMonth },
    (_, i) => (i < firstDay.getDay() ? null : i - firstDay.getDay() + 1),
  );

  function shiftMonth(amount: number) {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={`${label}: ${selectedLabel}`}
        aria-expanded={open}
        aria-controls={popupId}
        onClick={() => {
          if (!open) {
            setVisibleMonth(
              new Date(selected.getFullYear(), selected.getMonth(), 1),
            );
          }
          setOpen((current) => !current);
        }}
        className="field-input flex min-h-11 items-center justify-between gap-3 text-left"
      >
        <span>{selectedLabel}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="16" rx="1" />
          <path d="M7 3v4m10-4v4M3 10h18" />
        </svg>
      </button>
      {open ? (
        <div
          id={popupId}
          className="border-border-strong bg-surface-raised absolute left-0 z-50 mt-2 w-[min(19rem,calc(100vw-3rem))] border p-3 shadow-xl"
          aria-label={`${label} calendar`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="hover:bg-surface-lifted focus-visible:outline-focus rounded-component flex h-9 w-9 items-center justify-center"
            >
              ‹
            </button>
            <strong className="text-sm">
              {new Intl.DateTimeFormat("en", {
                month: "long",
                year: "numeric",
              }).format(visibleMonth)}
            </strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="hover:bg-surface-lifted focus-visible:outline-focus rounded-component flex h-9 w-9 items-center justify-center"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((day) => (
              <span
                key={day}
                className="text-subtle-foreground py-1 text-[0.65rem]"
                aria-hidden="true"
              >
                {day}
              </span>
            ))}
            {days.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />;
              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day,
                12,
              );
              const iso = toIsoDate(date);
              const isSelected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-label={new Intl.DateTimeFormat("en", {
                    dateStyle: "full",
                  }).format(date)}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`hover:bg-surface-lifted focus-visible:outline-focus rounded-component flex h-9 items-center justify-center text-sm ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "text-foreground"}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
