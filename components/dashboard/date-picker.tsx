"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  monthDays,
  shiftMonth,
  tokyoDay,
  displayDay,
} from "../../src/dashboard/presentation.ts";
import { DashboardIcon } from "./icon.tsx";
import { MonthNavigation, monthLabel } from "./month-navigation.tsx";

function dayInMonth(day: string, month: string) {
  const days = monthDays(month).filter((value): value is string =>
    Boolean(value),
  );
  return days[Math.min(Number(day.slice(-2)), days.length) - 1];
}
export function DatePicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (day: string) => void;
  disabled: boolean;
}) {
  const today = tokyoDay(new Date());
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const [active, setActive] = useState(value || today);
  const [placement, setPlacement] = useState({ above: false, space: 380 });
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const focusDay = useRef(false);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (open && focusDay.current) {
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)
        ?.focus();
      focusDay.current = false;
    }
  }, [open, month, active]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function choose(day: string) {
    onChange(day);
    close();
  }
  function moveMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setActive(dayInMonth(active, next));
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const date = new Date(`${day}T12:00:00Z`);
    const weekday = (date.getUTCDay() + 6) % 7;
    const shifts: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    let next: string;
    if (event.key in shifts) {
      date.setUTCDate(date.getUTCDate() + shifts[event.key]);
      next = date.toISOString().slice(0, 10);
    } else if (event.key === "PageUp" || event.key === "PageDown")
      next = dayInMonth(
        day,
        shiftMonth(month, event.key === "PageUp" ? -1 : 1),
      );
    else return;
    event.preventDefault();
    focusDay.current = true;
    setActive(next);
    setMonth(next.slice(0, 7));
  }
  return (
    <div
      className="dashboard-date-picker"
      data-side={placement.above ? "top" : "bottom"}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <input
        type="hidden"
        name="sessionDate"
        value={value}
        disabled={disabled}
      />
      <button
        id={id}
        ref={trigger}
        type="button"
        className="application-select-trigger dashboard-date-trigger"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open && !disabled}
        aria-controls={`${id}-calendar`}
        onClick={() => {
          if (open) setOpen(false);
          else {
            const bounds = trigger.current?.getBoundingClientRect();
            if (bounds) {
              const below = window.innerHeight - bounds.bottom - 20;
              const above = bounds.top - 100;
              const flip = below < 350 && above > below;
              setPlacement({
                above: flip,
                space: Math.max(160, Math.min(380, flip ? above : below)),
              });
            }
            const day = value || today;
            setMonth(day.slice(0, 7));
            setActive(day);
            focusDay.current = true;
            setOpen(true);
          }
        }}
      >
        <span id={`${id}-value`} className={value ? undefined : "muted"}>
          {value ? displayDay(value) : "Choose a date"}
        </span>
        <DashboardIcon name="calendar" />
      </button>
      {open && !disabled ? (
        <div
          id={`${id}-calendar`}
          className="dashboard-date-popover"
          style={{ maxHeight: placement.space }}
          role="dialog"
          aria-label="Choose absence date"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <MonthNavigation
            month={month}
            onPrevious={() => moveMonth(-1)}
            onNext={() => moveMonth(1)}
          />
          <div
            role="grid"
            aria-label={monthLabel(month)}
            className="dashboard-date-grid"
          >
            <div role="row" className="dashboard-date-week">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day} role="columnheader">
                  {day}
                </span>
              ))}
            </div>
            {Array.from({ length: monthDays(month).length / 7 }, (_, row) => (
              <div key={row} role="row" className="dashboard-date-week">
                {monthDays(month)
                  .slice(row * 7, row * 7 + 7)
                  .map((day, column) => (
                    <div
                      role="gridcell"
                      key={day ?? column}
                      aria-selected={day ? day === value : undefined}
                    >
                      {day ? (
                        <button
                          type="button"
                          data-day={day}
                          tabIndex={day === active ? 0 : -1}
                          aria-label={displayDay(day)}
                          aria-current={day === today ? "date" : undefined}
                          className={day === value ? "is-selected" : ""}
                          onFocus={() => setActive(day)}
                          onKeyDown={(event) => keyboard(event, day)}
                          onClick={() => choose(day)}
                        >
                          {Number(day.slice(-2))}
                        </button>
                      ) : null}
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <div className="dashboard-date-footer">
            <button type="button" onClick={() => choose(today)}>
              Today
            </button>
            {value ? (
              <button type="button" onClick={() => choose("")}>
                Clear date
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
