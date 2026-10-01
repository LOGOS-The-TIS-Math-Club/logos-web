"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { MAX_IMAGE_BYTES } from "@/lib/images/format";

export interface ImageSummary {
  id: string;
  mimeType: string;
  byteSize: number;
  altText: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

/*
 * Choosing or uploading the picture attached to a piece of content.
 *
 * The description sits next to the file input and the upload button is
 * disabled without it, because it is written once, by the only person who
 * knows what the photograph shows. Asking for it later never works.
 */
export interface ImagePickerHandle {
  /** Upload a selected file, if any, and return the image id to attach. */
  uploadPending(): Promise<string | null>;
}

export const ImagePicker = forwardRef<
  ImagePickerHandle,
  {
    value: string | null;
    onChange: (imageId: string | null) => void;
    uploadOnSave?: boolean;
  }
>(function ImagePicker({ value, onChange, uploadOnSave = false }, ref) {
  const [library, setLibrary] = useState<ImageSummary[]>([]);
  const [altText, setAltText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadTask = useRef<Promise<string | null> | null>(null);

  const fileId = useId();
  const altId = useId();
  const selectId = useId();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/images")
      .then((response) => (response.ok ? response.json() : { images: [] }))
      .then((payload) => {
        if (!cancelled) setLibrary(payload.images ?? []);
      })
      .catch(() => {
        // A library that will not load should not block writing the entry.
        if (!cancelled) setLibrary([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const uploadPending = useCallback((): Promise<string | null> => {
    if (uploadTask.current) return uploadTask.current;
    if (!file) return Promise.resolve(value);
    if (!altText.trim()) {
      const message = "Describe the picture before saving the story.";
      setError(message);
      return Promise.reject(new Error(message));
    }

    setUploading(true);
    setError(null);

    const task = (async (): Promise<string> => {
      try {
        const body = new FormData();
        body.set("file", file);
        body.set("altText", altText);

        const headers: Record<string, string> = {};
        const csrfToken = decodeURIComponent(getCookie("__Host-logos_csrf"));
        const sessionCsrfToken = decodeURIComponent(
          getCookie("__Host-logos_session_csrf"),
        );
        if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
        if (sessionCsrfToken)
          headers["X-Session-CSRF-Token"] = sessionCsrfToken;

        // No Content-Type header: the browser must set the multipart boundary.
        const response = await fetch("/api/admin/images", {
          method: "POST",
          headers,
          body,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || "Upload failed");
        }

        setLibrary((prev) => [...prev, payload.image]);
        onChange(payload.image.id);
        setFile(null);
        setAltText("");
        return payload.image.id as string;
      } catch (uploadError: unknown) {
        const message =
          uploadError instanceof Error ? uploadError.message : "Upload failed";
        setError(message);
        throw new Error(message);
      } finally {
        setUploading(false);
        uploadTask.current = null;
      }
    })();
    uploadTask.current = task;
    return task;
  }, [file, altText, value, onChange]);

  useImperativeHandle(ref, () => ({ uploadPending }), [uploadPending]);

  const handleUpload = () => {
    void uploadPending().catch(() => {
      // The picker displays the upload error next to the file controls.
    });
  };

  const selected = library.find((image) => image.id === value) ?? null;

  return (
    <div className="border-border space-y-4 border-t pt-4">
      <p className="text-foreground text-xs font-medium">Picture (optional)</p>

      {library.length > 0 && (
        <div>
          <label
            htmlFor={selectId}
            className="text-subtle-foreground block text-xs"
          >
            Use an existing picture
          </label>
          <select
            id={selectId}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value || null)}
            className="field-input"
          >
            <option value="">No picture</option>
            {library.map((image) => (
              <option key={image.id} value={image.id}>
                {image.altText.slice(0, 60)}
              </option>
            ))}
          </select>
        </div>
      )}

      {value && (
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a same-origin upload; the optimiser adds nothing here. */}
          <img
            src={`/api/images/${value}`}
            alt={selected?.altText ?? ""}
            className="border-border max-h-40 w-auto border object-contain"
          />
          <figcaption className="text-subtle-foreground text-xs">
            {selected?.width && selected.height
              ? `${selected.width}×${selected.height}, `
              : ""}
            {selected
              ? `${Math.round(selected.byteSize / 1024)} KB`
              : "Loading picture…"}
          </figcaption>
        </figure>
      )}

      <details className="text-xs">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
          Upload a new picture
        </summary>

        <div className="mt-3 space-y-3">
          <div>
            <label
              htmlFor={fileId}
              className="text-subtle-foreground block text-xs"
            >
              File
            </label>
            <input
              id={fileId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={uploading}
              className="text-muted-foreground mt-1 block w-full text-xs"
            />
            <p className="text-subtle-foreground mt-1">
              JPEG, PNG, WebP or GIF, up to{" "}
              {Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB.
            </p>
          </div>

          <div>
            <label
              htmlFor={altId}
              className="text-subtle-foreground block text-xs"
            >
              Describe the picture
            </label>
            <input
              id={altId}
              type="text"
              maxLength={300}
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              disabled={uploading}
              placeholder="Six students at a whiteboard covered in working"
              className="field-input"
            />
            <p className="text-subtle-foreground mt-1">
              Required. This is what someone using a screen reader hears in
              place of the picture.
            </p>
            {uploadOnSave ? (
              <p className="text-subtle-foreground mt-1">
                Saving the story uploads and attaches this picture.
              </p>
            ) : null}
          </div>

          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || !altText.trim() || uploading}
            className="control"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </details>
    </div>
  );
});
