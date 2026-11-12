"use client";

import { useEffect, useRef, useState } from "react";
import type { PostImage } from "../src/content/operations.ts";
import { ContentImage } from "./content-image.tsx";
import { DashboardIcon } from "./dashboard/icon.tsx";
import { useMotionEnabled } from "./motion-control.tsx";

const ADVANCE_MS = 6000;

export function PostImageGallery({
  images, primary, story = false, priority = false,
}: {
  images: readonly PostImage[];
  primary?: PostImage;
  story?: boolean;
  priority?: boolean;
}) {
  const slides = primary ? [primary, ...images] : images;
  const count = slides.length;
  const multiple = count > 1;
  const root = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState({ index: 0, previous: 0 });
  const [inView, setInView] = useState(false);
  const [systemMotion, setSystemMotion] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const motionEnabled = useMotionEnabled();
  const index = Math.min(selection.index, Math.max(0, count - 1));
  const autoplay = multiple && motionEnabled && systemMotion;
  const playing = autoplay && documentVisible && inView && !hovered && !focused;

  useEffect(() => {
    if (!multiple) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setSystemMotion(!motion.matches);
      setDocumentVisible(!document.hidden);
    };
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [multiple]);

  useEffect(() => {
    if (!multiple || !root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.intersectionRatio >= 0.35),
      { threshold: 0.35 },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [multiple]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setSelection({ index: (index + 1) % count, previous: index });
    }, ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, count, index]);

  if (!count) return null;

  function goTo(next: number) {
    if (next !== index) setSelection({ index: next, previous: index });
  }

  function move(direction: -1 | 1) {
    goTo((index + direction + count) % count);
  }

  return (
    <div
      ref={root}
      className="post-image-gallery"
      data-multiple={multiple}
      role={multiple ? "group" : undefined}
      aria-label={multiple ? (story ? "Story image gallery" : "Announcement image gallery") : undefined}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div
        className="post-image-stage"
        onTouchStart={(event) => {
          if (!multiple || event.touches.length !== 1) { touchStart.current = null; return; }
          const { clientX, clientY } = event.touches[0];
          touchStart.current = { x: clientX, y: clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || event.touches.length) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4)
            move(dx < 0 ? 1 : -1);
        }}
        onTouchCancel={() => { touchStart.current = null; }}
      >
        {slides.map(({ id, alt, width, height }, slide) => {
          const active = slide === index;
          const next = (index + 1) % count;
          const previous = (index - 1 + count) % count;
          const nearby = active || slide === selection.previous || slide === previous || slide === next;
          return (
            <div
              className="post-image-slide"
              key={id}
              data-active={active}
              data-side={slide === previous || (slide !== next && slide < index) ? "left" : "right"}
              inert={!active}
            >
              {nearby ? (
                <ContentImage
                  id={id}
                  alt={alt}
                  width={width}
                  height={height}
                  priority={(priority && slide === 0) || (inView && slide === next)}
                  unavailableMessage={story ? "Story image unavailable." : "Announcement image unavailable."}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {multiple ? (
        <div
          className="post-image-controls"
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }}
        >
          <span className="sr-only" aria-live={playing ? "off" : "polite"}>
            Image {index + 1} of {count}
            {slides[index].alt ? `: ${slides[index].alt}` : null}
          </span>
          <button type="button" className="post-image-arrow" aria-label="Previous image" onClick={() => move(-1)}>
            <DashboardIcon name="left" />
          </button>
          <div className="post-image-index" role="group" aria-label="Choose an image">
            {slides.map(({ id }, slide) => (
              <button type="button" key={id} aria-label={`Show image ${slide + 1} of ${count}`}
                aria-current={slide === index ? "true" : undefined} onClick={() => goTo(slide)} />
            ))}
          </div>
          <button type="button" className="post-image-arrow" aria-label="Next image" onClick={() => move(1)}>
            <DashboardIcon name="right" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
