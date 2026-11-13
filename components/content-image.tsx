"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LoadingImageProps = {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  unavailableMessage?: string;
  priority?: boolean;
  className?: string;
};

export function ContentImage({ id, ...props }: Omit<LoadingImageProps, "src" | "className"> & { id: string }) {
  return <LoadingImage {...props} src={`/api/public/images/${id}`} className="content-image" />;
}

export function LoadingImage(props: LoadingImageProps) {
  return <ImageWithRetry key={props.src} {...props} />;
}

function ImageWithRetry({ src, ...props }: LoadingImageProps) {
  const [attempt, setAttempt] = useState(0);
  const retrySrc = attempt && src.startsWith("/")
    ? `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`
    : src;
  return <ImageAttempt key={attempt} {...props} src={retrySrc} retry={() => setAttempt(attempt + 1)} />;
}

function ImageAttempt({
  src, alt, width, height, unavailableMessage = "Image unavailable.", priority = false, className, retry,
}: LoadingImageProps & { retry: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const reveal = useCallback((image: HTMLImageElement) => {
    void image.decode().then(
      () => { if (imageRef.current === image) setStatus("ready"); },
      () => { if (imageRef.current === image) setStatus("failed"); },
    );
  }, []);

  useEffect(() => {
    // Cached images may finish before hydration attaches the load handler.
    const image = imageRef.current;
    if (!image?.complete) return;
    if (image.naturalWidth) reveal(image);
    else setStatus("failed");
  }, [reveal]);

  if (status === "failed") return (
    <div className="image-unavailable">
      <p role="status">{unavailableMessage}{alt ? ` ${alt}` : ""}</p>
      <button type="button" className="action action-sm" onClick={retry}>Retry image</button>
    </div>
  );

  return (
    <div className={`image-frame ${className ?? ""}`} data-loading={status === "loading"} data-sized={Boolean(width && height)}>
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={(event) => reveal(event.currentTarget)}
        onError={() => setStatus("failed")}
      />
    </div>
  );
}
