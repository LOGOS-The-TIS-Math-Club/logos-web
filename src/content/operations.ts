import sharp from "sharp";
import { createHash } from "node:crypto";
import { createContentOnce } from "./replay.ts";
import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
import { MAX_POST_IMAGES, MAX_UPLOAD_BYTES } from "./image-limits.ts";
import {
  announcementInput,
  creationRequestInput,
  clubInfoInput,
  imageInput,
  leadershipInput,
  resourceInput,
  revisionInput,
  storyInput,
} from "./input.ts";

type Tx = postgres.TransactionSql;

const imageFormats = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
} as const;

type Upload = z.input<typeof imageInput>;

function uploadFingerprint(upload: z.infer<typeof imageInput> | undefined) {
  return upload ? {
    mimeType: upload.mimeType,
    altText: upload.altText,
    sha256: createHash("sha256").update(upload.data).digest("hex"),
  } : null;
}


async function validateImage(raw: Upload | undefined) {
  if (raw === undefined) return undefined;
  const image = imageInput.parse(raw);
  const decoder = sharp(image.data, {
    failOn: "error",
    limitInputPixels: 16_777_216,
    animated: false,
  });
  let metadata: Awaited<ReturnType<typeof decoder.metadata>>;
  try {
    metadata = await decoder.metadata();
  } catch {
    throw new z.ZodError([
      { code: "custom", path: ["image"], message: "Image data is malformed or incomplete" },
    ]);
  }
  const expectedMime = metadata.format && imageFormats[metadata.format as keyof typeof imageFormats];
  if (!metadata.width || !metadata.height || !expectedMime || expectedMime !== image.mimeType) {
    throw new z.ZodError([
      { code: "custom", path: ["image"], message: "Image bytes do not match the declared image type" },
    ]);
  }
  if (metadata.width > 8192 || metadata.height > 8192 || metadata.width * metadata.height > 16_777_216) {
    throw new z.ZodError([
      { code: "custom", path: ["image"], message: "Image dimensions exceed the allowed limit" },
    ]);
  }
  // Force a full decode so a valid header with truncated/corrupt image data is rejected.
  try {
    await decoder.toBuffer();
  } catch {
    throw new z.ZodError([
      { code: "custom", path: ["image"], message: "Image data is malformed or incomplete" },
    ]);
  }
  return { ...image, width: metadata.width, height: metadata.height };
}

function uuid(value: string) {
  return z.uuid().parse(value).toLowerCase();
}

async function requireAdmin(tx: Tx, actor: string) {
  await tx`select people.require_admin(${actor})`;
}

async function recordHistory(
  tx: Tx,
  actor: string,
  action: string,
  entity: string,
  details: Record<string, string | number | boolean | null>,
) {
  await tx`insert into operations.change_history(actor_id, action, entity_id, details)
    values (${actor}, ${action}, ${entity}, ${tx.json(details)})`;
}

async function requireExistingOrConflict(
  tx: Tx,
  table: "content.stories" | "content.announcements" | "content.leadership_profiles" | "content.resource_links" | "content.club_info",
  id: string | boolean,
) {
  let rows;
  if (table === "content.stories") rows = await tx`select 1 from content.stories where id=${id}`;
  else if (table === "content.announcements") rows = await tx`select 1 from content.announcements where id=${id}`;
  else if (table === "content.leadership_profiles") rows = await tx`select 1 from content.leadership_profiles where id=${id}`;
  else if (table === "content.resource_links") rows = await tx`select 1 from content.resource_links where id=${id}`;
  else rows = await tx`select 1 from content.club_info where id=${id}`;
  if (!rows.length) throw new BackendError("NOT_FOUND", "Content was not found", 404);
  throw new BackendError("CONFLICT", "Content changed since it was loaded", 409);
}

async function insertImage(tx: Tx, actor: string, image: Awaited<ReturnType<typeof validateImage>>) {
  if (!image) return null;
  const [row] = await tx`insert into content.images(mime_type, data, alt_text, width, height, uploaded_by)
    values (${image.mimeType}, ${image.data}, ${image.altText}, ${image.width}, ${image.height}, ${actor})
    returning id`;
  return row.id as string;
}

type PostImageParent = "story_id" | "announcement_id";
export type PostImage = {
  id: string;
  alt: string;
  width: number | null;
  height: number | null;
};

// Queries using this projection alias their post as p.
function additionalImages(sql: postgres.Sql | Tx, parent: PostImageParent) {
  return sql`coalesce((select json_agg(json_build_object(
    'id', img.id, 'alt', img.alt_text, 'width', img.width, 'height', img.height
  ) order by pi.position)
  from content.post_images pi join content.images img on img.id=pi.image_id
  where pi.${sql(parent)}=p.id), '[]'::json)`;
}

function galleryInput(raw: unknown, uploads: Upload[], creating = false) {
  const { removeImageIds } = z.object({
    removeImageIds: z.array(z.uuid()).max(creating ? 0 : MAX_POST_IMAGES).default([]),
  }).parse(raw);
  const images = z.array(imageInput).max(MAX_POST_IMAGES).parse(uploads);
  if (images.reduce((total, image) => total + image.data.byteLength, 0) > MAX_UPLOAD_BYTES)
    throw new BackendError("TOO_LARGE", "New images must total 3 MiB or less.", 413);
  return { images, removeImageIds };
}

async function saveGallery(
  tx: Tx, actor: string, parent: PostImageParent, post: { id: string; image_id: string | null },
  gallery: ReturnType<typeof galleryInput>,
) {
  const { images, removeImageIds } = gallery;
  if (!images.length && !removeImageIds.length && !post.image_id) return;
  if (removeImageIds.length)
    await tx`delete from content.post_images where ${tx(parent)}=${post.id}
      and image_id=any(${tx.array(removeImageIds)}::uuid[])`;
  const [current] = await tx`select count(*)::int as count, coalesce(max(position), -1)::int as last
    from content.post_images where ${tx(parent)}=${post.id}`;
  if (current.count + images.length + Number(post.image_id !== null) > MAX_POST_IMAGES)
    throw new BackendError("INVALID_INPUT", `A post can have at most ${MAX_POST_IMAGES} images.`, 422);
  let position = current.last as number;
  for (const upload of images) {
    const imageId = await insertImage(tx, actor, await validateImage(upload));
    await tx`insert into content.post_images(${tx(parent)}, image_id, position)
      values (${post.id}, ${imageId}, ${++position})`;
  }
}

async function reorderStoryImages(
  tx: Tx, story: { id: string; image_id: string | null }, order: number[],
) {
  const links = await tx<{ image_id: string }[]>`select image_id from content.post_images
    where story_id=${story.id} order by position`;
  const images = links.map((link) => link.image_id);
  if (story.image_id) images.unshift(story.image_id);
  if (order.length !== images.length || new Set(order).size !== images.length ||
      order.some((index) => index >= images.length)) {
    throw new BackendError("INVALID_INPUT", "Image order must include each image exactly once.", 422);
  }
  if (order.every((index, position) => index === position)) return;

  const keepLegacy = story.image_id && order[0] === 0;
  if (story.image_id && !keepLegacy) {
    await tx`update content.stories set image_id=null where id=${story.id}`;
  }
  await tx`delete from content.post_images where story_id=${story.id}`;
  const gallery = keepLegacy ? order.slice(1) : order;
  for (const [position, index] of gallery.entries()) {
    await tx`insert into content.post_images(story_id, image_id, position)
      values (${story.id}, ${images[index]}, ${position})`;
  }
}

export interface PublicStory {
  id: string;
  title: string;
  occurred_on: Date;
  description: string;
  image_id: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  additional_images: PostImage[];
  published: boolean;
  created_at: Date;
  updated_at: Date;
}

export function getPublishedStories(sql: postgres.Sql) {
  return sql<PublicStory[]>`select p.id, p.title, p.occurred_on, p.description, p.image_id, p.published, p.created_at, p.updated_at,
    i.alt_text as image_alt, i.width as image_width, i.height as image_height,
    ${additionalImages(sql, "story_id")} as additional_images
    from content.stories p left join content.images i on i.id=p.image_id
    where p.published order by p.occurred_on desc, p.created_at desc, p.id`;
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  body: string;
  image_id: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  additional_images: PostImage[];
  published_at: Date;
  created_at: Date;
  updated_at: Date;
}

export function getPublishedAnnouncements(sql: postgres.Sql) {
  return sql<PublicAnnouncement[]>`select p.id, p.title, p.body, p.image_id, p.published_at, p.created_at, p.updated_at,
    i.alt_text as image_alt, i.width as image_width, i.height as image_height,
    ${additionalImages(sql, "announcement_id")} as additional_images
    from content.announcements p left join content.images i on i.id=p.image_id
    where p.published_at <= now() order by p.published_at desc, p.id`;
}

export function getPublishedLeadership(sql: postgres.Sql) {
  return sql`select id, display_name, title, biography, image_id, sort_order
    from content.leadership_profiles where published order by sort_order, display_name`;
}

export function getResources(sql: postgres.Sql) {
  return sql`select id, title, description, url, sort_order, created_at, updated_at
    from content.resource_links where published order by sort_order, title`;
}

export async function getClubInfo(sql: postgres.Sql) {
  const [row] = await sql<{ about: string; semester_focus: string; contact_email: string }[]>`select about, semester_focus, contact_email from content.club_info where id=true`;
  return row ?? null;
}

export async function listAdminStories(sql: postgres.Sql, actorId: string) {
  const actor = uuid(actorId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    return tx`select id, title, occurred_on, description, image_id, published, created_at, updated_at, revision
      from content.stories order by occurred_on desc, created_at desc`;
  });
}

export async function getAdminStory(sql: postgres.Sql, actorId: string, id: string) {
  const actor = uuid(actorId);
  const storyId = uuid(id);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`select p.*, ${additionalImages(tx, "story_id")} as additional_images
      from content.stories p where p.id=${storyId}`;
    if (!row) throw new BackendError("NOT_FOUND", "Story was not found", 404);
    return row;
  });
}

export async function listAdminAnnouncements(sql: postgres.Sql, actorId: string) {
  const actor = uuid(actorId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    return tx`select id, title, body, image_id, published_at, created_by, created_at, updated_at, revision
      from content.announcements order by created_at desc`;
  });
}

export async function getAdminAnnouncement(sql: postgres.Sql, actorId: string, id: string) {
  const actor = uuid(actorId);
  const announcementId = uuid(id);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`select p.*, ${additionalImages(tx, "announcement_id")} as additional_images
      from content.announcements p where p.id=${announcementId}`;
    if (!row) throw new BackendError("NOT_FOUND", "Announcement was not found", 404);
    return row;
  });
}

export async function listAdminLeadership(sql: postgres.Sql, actorId: string) {
  const actor = uuid(actorId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    return tx`select id, member_id, display_name, title, biography, image_id, sort_order, published, revision
      from content.leadership_profiles order by sort_order, display_name`;
  });
}

export async function getAdminLeadershipProfile(sql: postgres.Sql, actorId: string, id: string) {
  const actor = uuid(actorId);
  const profileId = uuid(id);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`select * from content.leadership_profiles where id=${profileId}`;
    if (!row) throw new BackendError("NOT_FOUND", "Leadership profile was not found", 404);
    return row;
  });
}

export const getAdminLeadership = getAdminLeadershipProfile;

export async function listAdminResources(sql: postgres.Sql, actorId: string) {
  const actor = uuid(actorId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    return tx`select id, title, description, url, sort_order, published, created_by, created_at, updated_at, revision
      from content.resource_links order by sort_order, title`;
  });
}

export async function getAdminResource(sql: postgres.Sql, actorId: string, id: string) {
  const actor = uuid(actorId);
  const resourceId = uuid(id);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`select * from content.resource_links where id=${resourceId}`;
    if (!row) throw new BackendError("NOT_FOUND", "Resource was not found", 404);
    return row;
  });
}

export async function getAdminClubInfo(sql: postgres.Sql, actorId: string) {
  const actor = uuid(actorId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`select * from content.club_info where id=true`;
    return row ?? null;
  });
}

export async function createImage(sql: postgres.Sql, actorId: string, raw: unknown) {
  const actor = uuid(actorId);
  const upload = imageInput.parse(raw);
  const { requestId } = creationRequestInput.parse(raw);
  return createContentOnce(sql, actor, "image", requestId, uploadFingerprint(upload), async (tx) => {
    const image = await validateImage(upload);
    if (!image) throw new BackendError("INVALID_INPUT", "An image upload is required", 400);
    const id = await insertImage(tx, actor, image);
    if (!id) throw new BackendError("UNAVAILABLE", "Image could not be saved", 503);
    const [row] = await tx`select id, mime_type, alt_text, width, height, uploaded_by, created_at
      from content.images where id=${id}`;
    await recordHistory(tx, actor, "content.image.created", id, { mimeType: row.mime_type });
    return row;
  });
}

export async function getPublicImage(sql: postgres.Sql, id: string) {
  const imageId = uuid(id);
  const [row] = await sql`select i.id, i.mime_type, i.data, i.alt_text, i.width, i.height
    from content.images i
    where i.id=${imageId} and (
      exists (select 1 from content.stories s where s.image_id=i.id and s.published)
      or exists (select 1 from content.announcements a where a.image_id=i.id and a.published_at <= now())
      or exists (select 1 from content.leadership_profiles l where l.image_id=i.id and l.published)
      or exists (select 1 from content.post_images pi
        left join content.stories s on s.id=pi.story_id
        left join content.announcements a on a.id=pi.announcement_id
        where pi.image_id=i.id and (s.published or a.published_at <= now()))
    )`;
  if (!row) throw new BackendError("NOT_FOUND", "Image was not found", 404);
  return row;
}

export async function getAdminImage(sql: postgres.Sql, actorId: string, id: string) {
  const actor = uuid(actorId);
  const imageId = uuid(id);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`select id, mime_type, data, alt_text, width, height
      from content.images where id=${imageId}`;
    if (!row) throw new BackendError("NOT_FOUND", "Image was not found", 404);
    return row;
  });
}

export async function createStory(sql: postgres.Sql, actorId: string, raw: unknown, upload?: Upload, uploads: Upload[] = []) {
  const actor = uuid(actorId);
  const input = storyInput.parse(raw);
  const gallery = galleryInput(raw, uploads, true);
  if (upload && gallery.images.length)
    throw new BackendError("INVALID_INPUT", "Use either upload or uploads, not both.", 422);
  const { requestId } = creationRequestInput.parse(raw);
  const selectedImage = upload === undefined ? undefined : imageInput.parse(upload);
  if (selectedImage && input.imageId) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
  return createContentOnce(sql, actor, "story", requestId, { ...input, imageId: input.imageId ?? null, upload: uploadFingerprint(selectedImage),
    ...(gallery.images.length ? { uploads: gallery.images.map(uploadFingerprint) } : {}) }, async (tx) => {
    const image = await validateImage(selectedImage);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId ?? null;
    const [row] = await tx`insert into content.stories(title, occurred_on, description, image_id, published, created_by)
      values (${input.title}, ${input.occurredOn}::text::date, ${input.description}, ${imageId}, ${input.published}, ${actor})
      returning *`;
    await saveGallery(tx, actor, "story_id", { id: row.id, image_id: row.image_id }, gallery);
    await recordHistory(tx, actor, "content.story.created", row.id, { title: input.title });
    return row;
  });
}

export async function updateStory(sql: postgres.Sql, actorId: string, id: string, expectedRevision: number, raw: unknown, upload?: Upload, uploads: Upload[] = []) {
  const actor = uuid(actorId);
  const storyId = uuid(id);
  const revision = revisionInput.parse(expectedRevision);
  const input = storyInput.parse(raw);
  const gallery = galleryInput(raw, uploads);
  const { imageOrder } = z.object({
    imageOrder: z.array(z.number().int().min(0).max(MAX_POST_IMAGES - 1)).max(MAX_POST_IMAGES).optional(),
  }).parse(raw);
  if (upload && gallery.images.length)
    throw new BackendError("INVALID_INPUT", "Use either upload or uploads, not both.", 422);
  if (upload && input.imageId != null) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const image = await validateImage(upload);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId;
    const keepImage = !image && imageId === undefined;
    const [row] = await tx`update content.stories set title=${input.title}, occurred_on=${input.occurredOn}::text::date,
      description=${input.description}, image_id=case when ${keepImage} then image_id else ${imageId ?? null} end,
      published=${input.published}, revision=revision+1
      where id=${storyId} and revision=${revision} returning *`;
    if (!row) await requireExistingOrConflict(tx, "content.stories", storyId);
    await saveGallery(tx, actor, "story_id", { id: row.id, image_id: row.image_id }, gallery);
    if (imageOrder) await reorderStoryImages(tx, { id: row.id, image_id: row.image_id }, imageOrder);
    await recordHistory(tx, actor, "content.story.updated", storyId, { title: input.title, revision: row.revision });
    if (!imageOrder) return row;
    const [updated] = await tx`select * from content.stories where id=${storyId}`;
    return updated;
  });
}

export async function createAnnouncement(sql: postgres.Sql, actorId: string, raw: unknown, upload?: Upload, uploads: Upload[] = []) {
  const actor = uuid(actorId);
  const input = announcementInput.parse(raw);
  const gallery = galleryInput(raw, uploads, true);
  if (upload && gallery.images.length)
    throw new BackendError("INVALID_INPUT", "Use either upload or uploads, not both.", 422);
  const { requestId } = creationRequestInput.parse(raw);
  const selectedImage = upload === undefined ? undefined : imageInput.parse(upload);
  if (selectedImage && input.imageId) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
  return createContentOnce(sql, actor, "announcement", requestId, { ...input, imageId: input.imageId ?? null, upload: uploadFingerprint(selectedImage),
    ...(gallery.images.length ? { uploads: gallery.images.map(uploadFingerprint) } : {}) }, async (tx) => {
    const image = await validateImage(selectedImage);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId ?? null;
    const [row] = await tx`insert into content.announcements(title, body, image_id, published_at, created_by)
      values (${input.title}, ${input.body}, ${imageId}, case when ${input.published} then now() else null end, ${actor}) returning *`;
    await saveGallery(tx, actor, "announcement_id", { id: row.id, image_id: row.image_id }, gallery);
    await recordHistory(tx, actor, "content.announcement.created", row.id, { title: input.title });
    return row;
  });
}

export async function updateAnnouncement(sql: postgres.Sql, actorId: string, id: string, expectedRevision: number, raw: unknown, upload?: Upload, uploads: Upload[] = []) {
  const actor = uuid(actorId);
  const announcementId = uuid(id);
  const revision = revisionInput.parse(expectedRevision);
  const input = announcementInput.parse(raw);
  const gallery = galleryInput(raw, uploads);
  if (upload && gallery.images.length)
    throw new BackendError("INVALID_INPUT", "Use either upload or uploads, not both.", 422);
  if (upload && input.imageId != null) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const image = await validateImage(upload);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId;
    const keepImage = !image && imageId === undefined;
    const [row] = await tx`update content.announcements set title=${input.title}, body=${input.body},
      image_id=case when ${keepImage} then image_id else ${imageId ?? null} end,
      published_at=case when ${input.published} then coalesce(published_at, now()) else null end,
      revision=revision+1
      where id=${announcementId} and revision=${revision} returning *`;
    if (!row) await requireExistingOrConflict(tx, "content.announcements", announcementId);
    await saveGallery(tx, actor, "announcement_id", { id: row.id, image_id: row.image_id }, gallery);
    await recordHistory(tx, actor, "content.announcement.updated", announcementId, { title: input.title, revision: row.revision });
    return row;
  });
}

export async function createLeadershipProfile(sql: postgres.Sql, actorId: string, raw: unknown, upload?: Upload) {
  const actor = uuid(actorId);
  const input = leadershipInput.parse(raw);
  const { requestId } = creationRequestInput.parse(raw);
  const selectedImage = upload === undefined ? undefined : imageInput.parse(upload);
  if (selectedImage && input.imageId) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
  return createContentOnce(sql, actor, "leadership", requestId, selectedImage ? { ...input, imageId: input.imageId ?? null, upload: uploadFingerprint(selectedImage) } : input, async (tx) => {
    const image = await validateImage(selectedImage);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId ?? null;
    const [row] = await tx`insert into content.leadership_profiles(member_id, display_name, title, biography, image_id, sort_order, published)
      values (${input.memberId ?? null}, ${input.displayName}, ${input.title}, ${input.biography}, ${imageId}, ${input.sortOrder}, ${input.published}) returning *`;
    await recordHistory(tx, actor, "content.leadership.created", row.id, { displayName: input.displayName, title: input.title });
    return row;
  });
}

export async function updateLeadershipProfile(sql: postgres.Sql, actorId: string, id: string, expectedRevision: number, raw: unknown, upload?: Upload) {
  const actor = uuid(actorId);
  const profileId = uuid(id);
  const revision = revisionInput.parse(expectedRevision);
  const input = leadershipInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    if (upload && input.imageId != null) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
    const image = await validateImage(upload);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId;
    const keepImage = !image && imageId === undefined;
    const [row] = await tx`update content.leadership_profiles set member_id=${input.memberId ?? null}, display_name=${input.displayName},
      title=${input.title}, biography=${input.biography}, image_id=case when ${keepImage} then image_id else ${imageId ?? null} end, sort_order=${input.sortOrder}, published=${input.published}, revision=revision+1
      where id=${profileId} and revision=${revision} returning *`;
    if (!row) await requireExistingOrConflict(tx, "content.leadership_profiles", profileId);
    await recordHistory(tx, actor, "content.leadership.updated", profileId, { displayName: input.displayName, title: input.title, revision: row.revision });
    return row;
  });
}

export async function createResource(sql: postgres.Sql, actorId: string, raw: unknown) {
  const actor = uuid(actorId);
  const input = resourceInput.parse(raw);
  const { requestId } = creationRequestInput.parse(raw);
  return createContentOnce(sql, actor, "resource", requestId, input, async (tx) => {
    const [row] = await tx`insert into content.resource_links(title, description, url, sort_order, published, created_by)
      values (${input.title}, ${input.description}, ${input.url}, ${input.sortOrder}, ${input.published}, ${actor}) returning *`;
    await recordHistory(tx, actor, "content.resource.created", row.id, { title: input.title });
    return row;
  });
}

export async function updateResource(sql: postgres.Sql, actorId: string, id: string, expectedRevision: number, raw: unknown) {
  const actor = uuid(actorId);
  const resourceId = uuid(id);
  const revision = revisionInput.parse(expectedRevision);
  const input = resourceInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`update content.resource_links set title=${input.title}, description=${input.description}, url=${input.url}, sort_order=${input.sortOrder}, published=${input.published}, revision=revision+1
      where id=${resourceId} and revision=${revision} returning *`;
    if (!row) await requireExistingOrConflict(tx, "content.resource_links", resourceId);
    await recordHistory(tx, actor, "content.resource.updated", resourceId, { title: input.title, published: input.published, revision: row.revision });
    return row;
  });
}

export async function createClubInfo(sql: postgres.Sql, actorId: string, raw: unknown) {
  const actor = uuid(actorId);
  const input = clubInfoInput.parse(raw);
  const { requestId } = creationRequestInput.parse(raw);
  return createContentOnce(sql, actor, "club_info", requestId, input, async (tx) => {
    const [row] = await tx`insert into content.club_info(id, about, semester_focus, contact_email) values (true, ${input.about}, ${input.semesterFocus}, ${input.contactEmail}) returning *`;
    await recordHistory(tx, actor, "content.club_info.created", z.uuid().parse("00000000-0000-0000-0000-000000000000"), { fields: "about,semester_focus,contact_email" });
    return row;
  });
}

export async function updateClubInfo(sql: postgres.Sql, actorId: string, expectedRevision: number, raw: unknown) {
  const actor = uuid(actorId);
  const revision = revisionInput.parse(expectedRevision);
  const input = clubInfoInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`update content.club_info set about=${input.about}, semester_focus=${input.semesterFocus}, contact_email=${input.contactEmail}, revision=revision+1
      where id=true and revision=${revision} returning *`;
    if (!row) await requireExistingOrConflict(tx, "content.club_info", true);
    await recordHistory(tx, actor, "content.club_info.updated", "00000000-0000-0000-0000-000000000000", { revision: row.revision });
    return row;
  });
}
