"use client";

import { useState } from "react";
import type { PostImage } from "../src/content/operations.ts";
import { ContentImage } from "./content-image.tsx";
import { DashboardIcon } from "./dashboard/icon.tsx";

export function PostImageGallery({
  images, primary, story = false, priority = false,
}: {
  images: readonly PostImage[];
  primary?: PostImage;
  story?: boolean;
  priority?: boolean;
}) {
  const slides = primary ? [primary, ...images] : images;
  const [selection, setSelection] = useState(0);
  if (!slides.length) return null;
  const index = Math.min(selection, slides.length - 1);
  const { id, alt, width, height } = slides[index];
  const multiple = slides.length > 1;
  function move(direction: -1 | 1) {
    setSelection((current) =>
      (Math.min(current, slides.length - 1) + direction + slides.length) % slides.length,
    );
  }
  return (
    <div
      className="post-image-gallery"
      data-multiple={multiple}
      role={multiple ? "group" : undefined}
      aria-label={multiple ? (story ? "Story image gallery" : "Announcement image gallery") : undefined}
    >
      <div className="post-image-stage">
        <ContentImage
          key={id}
          id={id}
          alt={alt}
          width={width}
          height={height}
          priority={priority && index === 0}
          unavailableMessage={story ? "Story image unavailable." : "Announcement image unavailable."}
        />
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
          <button type="button" aria-label="Previous image" onClick={() => move(-1)}>
            <DashboardIcon name="left" />
          </button>
          <span className="datum muted" aria-live="polite">
            <span className="sr-only">Image </span>{index + 1} of {slides.length}
            {alt ? <span className="sr-only">: {alt}</span> : null}
          </span>
          <button type="button" aria-label="Next image" onClick={() => move(1)}>
            <DashboardIcon name="right" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
