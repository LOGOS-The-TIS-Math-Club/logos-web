"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type Option = readonly [value: string, label: string];

export function ApplicationSelect({
  id,
  name,
  options,
  placeholder,
  required = false,
  disabled = false,
  invalid = false,
  describedBy,
  onValueChange,
  value: controlledValue,
  defaultValue = "",
}: {
  id: string;
  name: string;
  options: readonly Option[];
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy: string;
  onValueChange: (value: string) => void;
  value?: string;
  defaultValue?: string;
}) {
  const [internalValue, setValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [side, setSide] = useState<"top" | "bottom">("bottom");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", at: 0 });
  const selected = options.findIndex(([key]) => key === value);

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
    if (!open) return;
    const panel = list.current;
    const option = panel?.children[active] as HTMLElement | undefined;
    if (!panel || !option) return;
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      panel.scrollTop + panel.clientHeight
    )
      panel.scrollTop =
        option.offsetTop + option.offsetHeight - panel.clientHeight;
  }, [open, active]);

  function expand(index = Math.max(selected, 0)) {
    const bounds = trigger.current?.getBoundingClientRect();
    if (bounds) {
      const below = window.innerHeight - bounds.bottom;
      setSide(
        below < Math.min(options.length * 44 + 12, 280) && bounds.top > below
          ? "top"
          : "bottom",
      );
    }
    setActive(index);
    setOpen(true);
  }
  function choose(index: number) {
    const next = options[index]?.[0];
    if (next === undefined || disabled) return;
    setValue(next);
    setOpen(false);
    trigger.current?.focus();
    if (next !== value) onValueChange(next);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (event.altKey && event.key === "ArrowUp") {
        setOpen(false);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open)
        expand(
          selected >= 0 ? selected : direction === 1 ? 0 : options.length - 1,
        );
      else
        setActive((index) =>
          Math.max(0, Math.min(options.length - 1, index + direction)),
        );
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : options.length - 1;
      if (!open) expand(index);
      else setActive(index);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else expand();
      return;
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = Date.now(),
        character = event.key.toLowerCase();
      const previous = now - search.current.at < 700 ? search.current.text : "";
      const text = previous === character ? character : previous + character;
      search.current = { text, at: now };
      const start = text.length === 1 ? (open ? active + 1 : selected + 1) : 0;
      const index = Array.from(
        { length: options.length },
        (_, offset) => (start + offset) % options.length,
      ).find((index) => options[index][1].toLowerCase().startsWith(text));
      if (index !== undefined) {
        if (!open) expand(index);
        else setActive(index);
      }
    }
  }

  return (
    <div
      ref={root}
      className="application-select"
      data-open={open && !disabled}
      data-side={side}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={describedBy}
        aria-expanded={open && !disabled}
        aria-haspopup="listbox"
        aria-controls={`${id}-options`}
        aria-activedescendant={
          open && !disabled ? `${id}-option-${active}` : undefined
        }
        title={selected >= 0 ? options[selected][1] : placeholder}
        aria-required={required}
        aria-invalid={invalid}
        className="application-select-trigger"
        onKeyDown={keyboard}
        onClick={() => {
          if (open) setOpen(false);
          else expand();
        }}
      >
        <span id={`${id}-value`} className={value ? undefined : "muted"}>
          {value && selected >= 0 ? options[selected][1] : placeholder}
        </span>
        <svg
          className="application-select-chevron"
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && !disabled ? (
        <div
          ref={list}
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="application-select-list"
        >
          {options.map(([key, label], index) => (
            <div
              key={key}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={key === value}
              data-active={active === index}
              className="application-select-option"
              onPointerMove={() => setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{label}</span>
              {key === value ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="m3 8 3 3 7-7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
