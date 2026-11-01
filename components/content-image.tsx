"use client";
import { useEffect, useRef, useState } from "react";

export function ContentImage({
  id,
  alt,
  width,
  height,
  unavailableMessage = "Image unavailable.",
  priority = false,
}: {
  id: string;
  alt: string;
  width: number | null;
  height: number | null;
  unavailableMessage?: string;
  priority?: boolean;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // An eager or cached image can fail before React attaches its error handler.
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, [id, attempt]);
  return failed ? (
    <div className="image-unavailable">
      <p role="status">
        {unavailableMessage}
        {alt ? ` ${alt}` : ""}
      </p>
      <button
        type="button"
        className="action action-sm"
        onClick={() => {
          setAttempt((value) => value + 1);
          setFailed(false);
        }}
      >
        Retry image
      </button>
    </div>
  ) : (
    <img
      ref={imageRef}
      src={`/api/public/images/${id}${attempt ? `?retry=${attempt}` : ""}`}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="content-image"
      onError={() => setFailed(true)}
    />
  );
}
