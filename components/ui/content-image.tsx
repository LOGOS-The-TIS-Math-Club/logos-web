/*
 * A picture attached to a piece of content.
 *
 * Deliberately a plain <img> rather than next/image. These are served from our
 * own /api/images route, which already sets immutable year-long caching, and
 * every upload is capped at 2MB with its intrinsic size recorded — so the
 * optimiser would add a second stored copy of each picture and a per-request
 * transform for no benefit the club would notice.
 *
 * Width and height are the point of this component. Without them the browser
 * cannot reserve space before the file arrives, and the text below jumps down
 * the page as each picture loads. They are read from the file header at upload
 * (lib/images/dimensions.ts); when a file's header could not be parsed they are
 * null, and the picture renders without the hint rather than not at all.
 */
export function ContentImage({
  imageId,
  alt,
  width,
  height,
  priority = false,
  className = "",
}: {
  imageId: string;
  /** Empty string is valid and means decorative — but content images have alt. */
  alt: string;
  width: number | null;
  height: number | null;
  /** Set for an image above the fold, so it is not lazily deferred. */
  priority?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- same-origin, already cached immutably by the route, and sized from the stored header; see the note above.
    <img
      src={`/api/images/${imageId}`}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`bg-surface h-auto w-full object-cover ${className}`}
    />
  );
}
