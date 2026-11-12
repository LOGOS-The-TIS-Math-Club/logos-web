"use client";
import Link from "next/link";
import { DashboardIcon } from "../dashboard/icon.tsx";
import { useEffect, useRef, useState } from "react";
import { ActionButton, ActionLink } from "../action.tsx";
import { DraftGuard } from "../dashboard/draft-guard.tsx";
import { adminRequest, AdminRequestError } from "../../src/admin/request.ts";
import { MAX_IMAGE_BYTES, MAX_POST_IMAGES, MAX_UPLOAD_BYTES } from "../../src/content/image-limits.ts";
import {
  useRead,
  AdminBack,
  useFeedback,
  AdminForm,
  Status,
  RecordLink,
  Filter,
  Search,
  ReadState,
  Panel,
  Field,
  Message,
  formValues,
  isoToday,
  day,
} from "./shared.tsx";
const kinds = [
  ["announcements", "Announcements"],
  ["stories", "Stories"],
  ["leadership", "Published leadership profiles"],
  ["resources", "Resource links"],
  ["club-info", "Club information"],
];
type Content = {
  id: string;
  revision: number;
  title?: string;
  display_name?: string;
  occurred_on?: string;
  description?: string;
  body?: string;
  biography?: string;
  image_id?: string | null;
  additional_images?: { id: string; alt: string }[];
  member_id?: string | null;
  sort_order?: number;
  published?: boolean;
  published_at?: string | null;
  url?: string;
  about?: string;
  semester_focus?: string;
  contact_email?: string;
};
export function ContentList({ kind }: { kind?: string }) {
  return !kind ? (
    <ul className="admin-tools">
      {kinds.map(([key, label]) => (
        <li key={key}>
          <Link className="admin-tool-link" href={`/admin/content/${key}`}>
            <strong>{label}</strong>
            <DashboardIcon name="right" />
          </Link>
        </li>
      ))}
    </ul>
  ) : kinds.some((k) => k[0] === kind) ? (
    <ContentRecords key={kind} kind={kind} />
  ) : (
    <p>Content tool not found.</p>
  );
}
function ContentRecords({ kind }: { kind: string }) {
  const [query, setQuery] = useState("");
  const read = useRead<Content[] | Content | null>(
    `/api/admin/content/${kind}`,
  );
  return (
    <>
      <AdminBack href="/admin/content">Content tools</AdminBack>
      <Panel title={kinds.find((k) => k[0] === kind)![1]}>
        <ReadState {...read} retry={read.refresh} />
        {kind === "club-info" ? (
          <ActionLink href="/admin/content/club-info/edit">
            Edit club information
          </ActionLink>
        ) : (
          <>
            <div className="admin-filter-bar">
              <Search value={query} onChange={setQuery} label="Find content" />
              <ActionLink href={`/admin/content/${kind}/new`} variant="primary">
                Create new
              </ActionLink>
            </div>
            <ul className="admin-rows">
              {Array.isArray(read.data)
                ? read.data
                    .filter((r) =>
                      String(r.title ?? r.display_name)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((r) => (
                      <li key={r.id}>
                        <RecordLink
                          href={`/admin/content/${kind}/${r.id}`}
                          title={r.title ?? r.display_name}
                          meta={r.occurred_on ? day(r.occurred_on) : undefined}
                          status={
                            (
                              kind === "announcements"
                                ? !!r.published_at
                                : r.published
                            )
                              ? "published"
                              : "draft"
                          }
                        />
                      </li>
                    ))
                : null}
            </ul>
            {Array.isArray(read.data) && !read.data.length ? (
              <p>No content records yet. Create the first one above.</p>
            ) : Array.isArray(read.data) &&
              query &&
              !read.data.some((r) =>
                String(r.title ?? r.display_name)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ) ? (
              <p className="admin-hint">No content matches this search.</p>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}
async function readUpload(file: File, altText: string) {
  if (!altText.trim()) throw new Error(`Add alt text for ${file.name}.`);
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("Choose an image no larger than 2 MiB.");
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("Choose a JPEG, PNG, WebP or GIF image.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { base64: btoa(binary), mimeType: file.type, altText };
}

function SavedPostImage({ id, alt, name }: { id: string; alt: string; name: string }) {
  return (
    <>
      <img className="admin-image" src={`/api/admin/content/images/${id}`} alt={alt} loading="lazy" />
      <label className="application-check">
        <input type="checkbox" name={name} /> Remove {alt || "this image"}
      </label>
    </>
  );
}
type GalleryEntry =
  | { key: string; id: string; alt: string; removeField: string }
  | { key: string; id: string; file: File };

export function ContentEditor({ kind, id }: { kind: string; id: string }) {
  const supportsGallery = kind === "stories" || kind === "announcements";
  const allowed = kinds.some((k) => k[0] === kind);
  const singular: Record<string, string> = {
    stories: "story",
    announcements: "announcement",
    leadership: "public leadership profile",
    resources: "resource link",
    "club-info": "club information",
  };
  const read = useRead<Content | null>(
    `/api/admin/content/${kind}${id === "new" || kind === "club-info" ? "" : "/" + id}`,
  );
  const [pending, setPending] = useState(false),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useFeedback(),
    [uncertain, setUncertain] = useState(false),
    [revision, setRevision] = useState(0);
  const snapshot = useRef<{
    body: Record<string, unknown>;
    method: string;
    url: string;
  } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [imageOrder, setImageOrder] = useState<string[]>([]);
  const [preview, setPreview] = useState("");
  const [publication, setPublication] = useState<boolean | undefined>();
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const existing = id === "new" ? null : read.data;
  const savedImages: GalleryEntry[] = [
    ...(existing?.image_id ? [{ key: "original", id: existing.image_id, alt: "", removeField: "removeImage" }] : []),
    ...(existing?.additional_images ?? []).map((image, index) => ({
      ...image, key: `saved-${index}-${image.id}`, removeField: `remove-image-${image.id}`,
    })),
  ];
  const gallery: GalleryEntry[] = [...savedImages, ...files.map((entry) => ({ ...entry, key: entry.id }))];
  const orderedGallery = kind === "stories" ? [
    ...imageOrder.flatMap((key) => gallery.filter((entry) => entry.key === key)),
    ...gallery.filter((entry) => !imageOrder.includes(entry.key)),
  ] : gallery;

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedGallery.length) return;
    const order = orderedGallery.map((entry) => entry.key);
    [order[index], order[target]] = [order[target], order[index]];
    setImageOrder(order);
    setDirty(true);
  }

  const publicAfterSave =
    publication ??
    (kind === "announcements"
      ? !!existing?.published_at
      : !!existing?.published);
  const isNew = id === "new" || (kind === "club-info" && !read.data);
  async function send(saved: NonNullable<typeof snapshot.current>) {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const result = await adminRequest<Content>(
        saved.url,
        saved.method,
        saved.body,
      );
      setUncertain(false);
      setConflict(false);
      snapshot.current = null;
      setDirty(false);
      setMessage("Saved successfully.");
      if (isNew && kind !== "club-info") setSavedId(result.id);
      else {
        setFile(null);
        setFiles([]);
        setImageOrder([]);
        read.refresh();
        setRevision((v) => v + 1);
      }
    } catch (error) {
      const e = error as Error;
      setMessage(e);
      if (!(e instanceof AdminRequestError) || e.status >= 500) {
        setUncertain(true);
      } else if (e.status === 409) {
        setConflict(true);
        setUncertain(true);
      } else {
        snapshot.current = null;
        setUncertain(false);
      }
    } finally {
      setPending(false);
    }
  }
  async function submit(form: HTMLFormElement) {
    if (pending || uncertain) return;
    setPending(true);
    try {
      const v = formValues(form);
      let body: Record<string, unknown> =
        kind === "club-info"
          ? {
              about: v.about,
              semesterFocus: v.semesterFocus,
              contactEmail: v.contactEmail,
            }
          : kind === "stories"
            ? {
                title: v.title,
                occurredOn: v.occurredOn,
                description: v.description,
                published: v.published === "on",
              }
            : kind === "announcements"
              ? {
                  title: v.title,
                  body: v.body,
                  published: v.published === "on",
                }
              : kind === "resources"
                ? {
                    title: v.title,
                    description: v.description,
                    url: v.url,
                    sortOrder: Number(v.sortOrder),
                    published: v.published === "on",
                  }
                : {
                    displayName: v.displayName,
                    title: v.title,
                    biography: v.biography,
                    sortOrder: Number(v.sortOrder),
                    published: v.published === "on",
                    memberId: existing?.member_id ?? null,
                  };
      if (supportsGallery) {
        const retained = (existing?.additional_images ?? []).filter(
          (image) => v[`remove-image-${image.id}`] !== "on",
        );
        const legacy = v.removeImage === "on" ? null : existing?.image_id ?? null;
        if (files.length + retained.length + Number(!!legacy) > MAX_POST_IMAGES)
          throw new Error(`A post can have at most ${MAX_POST_IMAGES} images.`);
        if (files.reduce((total, { file }) => total + file.size, 0) > MAX_UPLOAD_BYTES)
          throw new Error("New images must total 3 MiB or less per save. Add the rest in a later edit.");
        body.imageId = legacy;
        body.removeImageIds = (existing?.additional_images ?? [])
          .filter((image) => v[`remove-image-${image.id}`] === "on")
          .map((image) => image.id);
        const uploads = orderedGallery.filter((entry) => "file" in entry);
        body.uploads = await Promise.all(uploads.map(({ id, file }) =>
          readUpload(file, String(v[`alt-${id}`] ?? "").trim()),
        ));
        if (kind === "stories" && existing && imageOrder.length) {
          const retained = savedImages.filter((entry) => "removeField" in entry && v[entry.removeField] !== "on");
          const defaultOrder = [...retained, ...uploads].map((entry) => entry.key);
          body.imageOrder = orderedGallery
            .filter((entry) => "file" in entry || v[entry.removeField] !== "on")
            .map((entry) => defaultOrder.indexOf(entry.key));
        }
      } else if (kind === "leadership") {
        if (file) body.upload = await readUpload(file, String(v.altText ?? ""));
        else
          body.imageId =
            v.removeImage === "on" ? null : (existing?.image_id ?? null);
      }

      body = isNew
        ? { ...body, requestId: crypto.randomUUID() }
        : { ...body, revision: existing?.revision };
      const saved = {
        body,
        method: isNew ? "POST" : "PUT",
        url: `/api/admin/content/${kind}${isNew || kind === "club-info" ? "" : "/" + id}`,
      };
      snapshot.current = saved;
      setPending(false);
      await send(saved);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e
          : new Error("The request could not be completed."),
      );
      setPending(false);
    }
  }
  if (!allowed) return <p>Content tool not found.</p>;
  return (
    <>
      <DraftGuard subject="unsaved draft" dirty={dirty || uncertain} />
      <AdminBack href={`/admin/content/${kind}`}>
        Back to content list
      </AdminBack>
      <Panel title={`${id === "new" ? "Create" : "Edit"} ${singular[kind]}`}>
        <ReadState
          {...read}
          retry={() => {
            if (
              (dirty || uncertain) &&
              !confirm(
                "Discard your draft and selected image, then load the saved record?",
              )
            )
              return;
            read.refresh();
          }}
        />
        <Message>{message}</Message>
        {savedId ? (
          <div className="dashboard-actions">
            <ActionLink href={`/admin/content/${kind}/${savedId}`}>
              Open saved content
            </ActionLink>
            <ActionButton
              onClick={() => {
                setSavedId(null);
                setFile(null);
                setFiles([]);
                setImageOrder([]);
                setPublication(undefined);
                setRevision((v) => v + 1);
                setMessage("");
              }}
            >
              Create another record
            </ActionButton>
          </div>
        ) : null}
        <ActionButton
          className="admin-utility"
          disabled={pending}
          onClick={() => {
            if (
              (!dirty && !uncertain) ||
              confirm(
                "Discard this draft after checking any uncertain save, and load the current record?",
              )
            ) {
              setDirty(false);
              setUncertain(false);
              snapshot.current = null;
              setFile(null);
              setFiles([]);
              setImageOrder([]);
              setPublication(undefined);
              setConflict(false);
              setRevision((v) => v + 1);
              read.refresh();
            }
          }}
        >
          <DashboardIcon name="refresh" /> Reload current content
        </ActionButton>
        {uncertain ? (
          <div className="notice">
            <h3>
              {conflict
                ? "Review the saved version"
                : "Check whether your save completed"}
            </h3>
            <p>
              {conflict
                ? "Your draft is still here. Open the saved version to compare it, then reload this record before editing the latest version."
                : "Your entries and selected image are retained. Check the saved content first. An unchanged retry will reuse the same submission."}
            </p>
            <div className="dashboard-actions">
              {!conflict ? (
                <ActionButton
                  disabled={pending}
                  onClick={() => snapshot.current && send(snapshot.current)}
                >
                  Retry unchanged save
                </ActionButton>
              ) : null}
              <ActionLink
                href={
                  isNew
                    ? `/admin/content/${kind}`
                    : `/admin/content/${kind}/${id}`
                }
                target="_blank"
              >
                Check saved content
              </ActionLink>
              {snapshot.current?.method === "POST" ? (
                <ActionButton
                  disabled={pending}
                  variant="danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Finish checking the saved content before starting a changed submission. Continue editing this draft?",
                      )
                    ) {
                      snapshot.current = null;
                      setUncertain(false);
                    }
                  }}
                >
                  Start a changed submission
                </ActionButton>
              ) : null}
            </div>
          </div>
        ) : null}
        {!read.loading && !read.error ? (
          <AdminForm
            feedback={message}
            method="post"
            key={revision}
            className="admin-form"
            onDirty={() => setDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e.currentTarget);
            }}
          >
            <fieldset disabled={pending || uncertain || !!savedId}>
              {kind === "club-info" ? (
                <>
                  <p>Club information is public when saved.</p>
                  <Field
                    name="about"
                    label="About LOGOS"
                    type="textarea"
                    value={existing?.about}
                    maxLength={10000}
                  />
                  <Field
                    name="semesterFocus"
                    label="Semester focus"
                    type="textarea"
                    value={existing?.semester_focus}
                    maxLength={4000}
                  />
                  <Field
                    name="contactEmail"
                    label="Contact email"
                    type="email"
                    value={existing?.contact_email ?? "mathclub@tokyois.com"}
                    required
                  />
                </>
              ) : (
                <>
                  {kind === "leadership" ? (
                    <>
                      <p>
                        Public profiles are separate from membership and admin
                        permissions. Publish only after the named person has
                        approved their profile.
                      </p>
                      <Field
                        name="displayName"
                        label="Display name"
                        value={existing?.display_name}
                        required
                        maxLength={80}
                      />
                    </>
                  ) : null}
                  <Field
                    name="title"
                    label={
                      kind === "leadership"
                        ? "Public leadership title"
                        : "Title"
                    }
                    value={existing?.title}
                    required
                    maxLength={kind === "resources" ? 80 : 120}
                  />
                  {kind === "stories" ? (
                    <>
                      <p>
                        Stories record club history and milestones. Description
                        is optional.
                      </p>
                      <Field
                        name="occurredOn"
                        label="Story date"
                        type="date"
                        value={existing?.occurred_on ?? isoToday()}
                        required
                      />
                    </>
                  ) : null}
                  {kind === "announcements" ? (
                    <Field
                      name="body"
                      label="Announcement text"
                      type="textarea"
                      value={existing?.body}
                      required
                      maxLength={2000}
                    />
                  ) : (
                    <Field
                      name={kind === "leadership" ? "biography" : "description"}
                      label={
                        kind === "leadership"
                          ? "Biography"
                          : "Description (optional)"
                      }
                      type="textarea"
                      value={
                        kind === "leadership"
                          ? existing?.biography
                          : existing?.description
                      }
                      maxLength={kind === "resources" ? 280 : 4000}
                    />
                  )}
                  {kind === "resources" ? (
                    <Field
                      name="url"
                      label="HTTPS resource URL"
                      type="url"
                      value={existing?.url}
                      required
                    />
                  ) : null}
                  {["resources", "leadership"].includes(kind) ? (
                    <Field
                      name="sortOrder"
                      label="Display order"
                      type="number"
                      value={existing?.sort_order ?? 0}
                    />
                  ) : null}
                  {supportsGallery ? (
                    <div className="admin-post-images">
                      <label htmlFor="content-gallery">Add images (optional)</label>
                      <input
                        id="content-gallery"
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => {
                          const selected = Array.from(e.currentTarget.files ?? []);
                          e.currentTarget.value = "";
                          if (!selected.length) return;
                          if (files.length + selected.length > MAX_POST_IMAGES) {
                            setMessage(new Error(`Select at most ${MAX_POST_IMAGES} new images at a time.`));
                            return;
                          }
                          setFiles((current) => [...current, ...selected.map(file => ({ id: crypto.randomUUID(), file }))]);
                          setDirty(true);
                        }}
                      />
                      <p className="admin-hint">Up to 8 images per post, 2 MiB each, and 3 MiB of new images per save.</p>
                      {kind === "stories" && orderedGallery.length > 1 ? (
                        <p className="admin-hint">Images appear in this order. The first image opens the gallery.</p>
                      ) : null}
                      {orderedGallery.map((entry, index) => (
                        <div key={entry.key} className="admin-post-image">
                          {"file" in entry ? (
                            <>
                              <p>{entry.file.name} · {Math.ceil(entry.file.size / 1024)} KB</p>
                              <Field name={`alt-${entry.id}`} label="Alt text (for screen readers)" required maxLength={300} />
                              <ActionButton onClick={() => {
                                setFiles(current => current.filter(image => image.id !== entry.id));
                                setDirty(true);
                              }}>Remove selected image</ActionButton>
                            </>
                          ) : (
                            <SavedPostImage id={entry.id} alt={entry.alt} name={entry.removeField} />
                          )}
                          {kind === "stories" && orderedGallery.length > 1 ? (
                            <div className="dashboard-actions">
                              <ActionButton aria-label={`Move image ${index + 1} earlier`}
                                disabled={index === 0} onClick={() => moveImage(index, -1)}>Move earlier</ActionButton>
                              <ActionButton aria-label={`Move image ${index + 1} later`}
                                disabled={index === orderedGallery.length - 1} onClick={() => moveImage(index, 1)}>Move later</ActionButton>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : kind === "leadership" ? (
                    <>
                      <label htmlFor="content-image">
                        Image (optional, up to 2 MiB)
                      </label>
                      <input
                        id="content-image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => {
                          setFile(e.target.files?.[0] ?? null);
                          setDirty(true);
                        }}
                      />
                      {preview ? (
                        <figure className="admin-upload-preview">
                          <img src={preview} alt="Selected image preview" />
                          <figcaption>
                            {file?.name} · {Math.ceil((file?.size ?? 0) / 1024)}{" "}
                            KB
                          </figcaption>
                        </figure>
                      ) : null}
                      {file ? (
                        <Field
                          name="altText"
                          label="Alt text (for screen readers)"
                          required
                          maxLength={300}
                        />
                      ) : null}
                      {existing?.image_id ? (
                        <>
                          <img
                            className="admin-image"
                            src={`/api/admin/content/images/${existing.image_id}`}
                            alt="Current content image"
                          />
                          <label className="application-check">
                            <input type="checkbox" name="removeImage" /> Remove
                            current image
                          </label>
                        </>
                      ) : null}
                      <p>
                        Save uploads and attaches the selected image in the same
                        operation.
                      </p>
                    </>
                  ) : null}
                  <div className="admin-publication">
                    <h3>Publication</h3>
                    <label className="application-check">
                      <input
                        type="checkbox"
                        name="published"
                        checked={publicAfterSave}
                        onChange={(e) => setPublication(e.target.checked)}
                      />{" "}
                      Publish on the public website when saved
                    </label>
                    <p>
                      Unchecked saves a private draft. Imported resource links
                      stay unpublished until explicitly reviewed.
                    </p>
                    <Status value={publicAfterSave ? "published" : "draft"} />
                  </div>
                </>
              )}
              <div className="admin-save-bar">
                <span className="admin-hint">
                  {dirty
                    ? "Unsaved changes"
                    : savedId
                      ? "Saved"
                      : "No unsaved changes"}
                </span>
                <ActionButton type="submit" variant="primary">
                  {pending
                    ? "Saving..."
                    : kind === "club-info"
                      ? "Save public club information"
                      : publicAfterSave
                        ? "Save and publish"
                        : "Save draft"}
                </ActionButton>
              </div>
            </fieldset>
          </AdminForm>
        ) : null}
      </Panel>
    </>
  );
}
