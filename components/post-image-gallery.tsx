import type { PostImage } from "../src/content/operations.ts";
import { ContentImage } from "./content-image.tsx";

export function PostImageGallery({
  images, story = false, priority = false,
}: {
  images: readonly PostImage[];
  story?: boolean;
  priority?: boolean;
}) {
  if (!images.length) return null;
  return (
    <div className="post-image-gallery">
      {images.map(({ id, alt, width, height }, index) => {
        const image = <ContentImage
          id={id} alt={alt} width={width} height={height}
          priority={priority && index === 0}
          unavailableMessage={story ? "Story image unavailable." : "Announcement image unavailable."}
        />;
        return story ? (
          <div className="plated" key={id}>
            <figure className="home-panel story-figure">{image}</figure>
          </div>
        ) : <div key={id}>{image}</div>;
      })}
    </div>
  );
}
