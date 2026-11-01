"use client";
import { useState } from "react";

export function AnnouncementImage({
  id,
  alt,
  width,
  height,
}: {
  id: string;
  alt: string;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return failed ? (
    <div className="image-unavailable">
      <p role="status">Announcement image unavailable.{alt ? ` ${alt}` : ""}</p>
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
      src={`/api/public/images/${id}${attempt ? `?retry=${attempt}` : ""}`}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className="announcement-image"
      onError={() => setFailed(true)}
    />
  );
}
