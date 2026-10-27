import sharp from "sharp";
import { createHash } from "node:crypto";
import { createContentOnce } from "./replay.ts";
import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
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

export function getPublishedStories(sql: postgres.Sql) {
  return sql`select id, title, occurred_on, description, image_id, published, created_at, updated_at
    from content.stories where published order by occurred_on desc, created_at desc`;
}

export function getPublishedAnnouncements(sql: postgres.Sql) {
  return sql`select id, title, body, image_id, published_at, created_at, updated_at
    from content.announcements where published_at <= now() order by published_at desc`;
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
  const [row] = await sql`select about, semester_focus, contact_email from content.club_info where id=true`;
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
    const [row] = await tx`select * from content.stories where id=${storyId}`;
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
    const [row] = await tx`select * from content.announcements where id=${announcementId}`;
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

export async function createStory(sql: postgres.Sql, actorId: string, raw: unknown, upload?: Upload) {
  const actor = uuid(actorId);
  const input = storyInput.parse(raw);
  const { requestId } = creationRequestInput.parse(raw);
  const selectedImage = upload === undefined ? undefined : imageInput.parse(upload);
  if (selectedImage && input.imageId) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
  return createContentOnce(sql, actor, "story", requestId, { ...input, imageId: input.imageId ?? null, upload: uploadFingerprint(selectedImage) }, async (tx) => {
    const image = await validateImage(selectedImage);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId ?? null;
    const [row] = await tx`insert into content.stories(title, occurred_on, description, image_id, published, created_by)
      values (${input.title}, ${input.occurredOn}::text::date, ${input.description}, ${imageId}, ${input.published}, ${actor})
      returning *`;
    await recordHistory(tx, actor, "content.story.created", row.id, { title: input.title });
    return row;
  });
}

export async function updateStory(sql: postgres.Sql, actorId: string, id: string, expectedRevision: number, raw: unknown, upload?: Upload) {
  const actor = uuid(actorId);
  const storyId = uuid(id);
  const revision = revisionInput.parse(expectedRevision);
  const input = storyInput.parse(raw);
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
    await recordHistory(tx, actor, "content.story.updated", storyId, { title: input.title, revision: row.revision });
    return row;
  });
}

export async function createAnnouncement(sql: postgres.Sql, actorId: string, raw: unknown, upload?: Upload) {
  const actor = uuid(actorId);
  const input = announcementInput.parse(raw);
  const { requestId } = creationRequestInput.parse(raw);
  const selectedImage = upload === undefined ? undefined : imageInput.parse(upload);
  if (selectedImage && input.imageId) throw new z.ZodError([{ code: "custom", path: ["imageId"], message: "Choose an image ID or upload an image" }]);
  return createContentOnce(sql, actor, "announcement", requestId, { ...input, imageId: input.imageId ?? null, upload: uploadFingerprint(selectedImage) }, async (tx) => {
    const image = await validateImage(selectedImage);
    const imageId = image ? await insertImage(tx, actor, image) : input.imageId ?? null;
    const [row] = await tx`insert into content.announcements(title, body, image_id, published_at, created_by)
      values (${input.title}, ${input.body}, ${imageId}, case when ${input.published} then now() else null end, ${actor}) returning *`;
    await recordHistory(tx, actor, "content.announcement.created", row.id, { title: input.title });
    return row;
  });
}

export async function updateAnnouncement(sql: postgres.Sql, actorId: string, id: string, expectedRevision: number, raw: unknown, upload?: Upload) {
  const actor = uuid(actorId);
  const announcementId = uuid(id);
  const revision = revisionInput.parse(expectedRevision);
  const input = announcementInput.parse(raw);
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
    await recordHistory(tx, actor, "content.announcement.updated", announcementId, { title: input.title, revision: row.revision });
    return row;
  });
}

export async function createLeadershipProfile(sql: postgres.Sql, actorId: string, raw: unknown) {
  const actor = uuid(actorId);
  const input = leadershipInput.parse(raw);
  const { requestId } = creationRequestInput.parse(raw);
  return createContentOnce(sql, actor, "leadership", requestId, input, async (tx) => {
    const [row] = await tx`insert into content.leadership_profiles(member_id, display_name, title, biography, image_id, sort_order, published)
      values (${input.memberId ?? null}, ${input.displayName}, ${input.title}, ${input.biography}, ${input.imageId ?? null}, ${input.sortOrder}, ${input.published}) returning *`;
    await recordHistory(tx, actor, "content.leadership.created", row.id, { displayName: input.displayName, title: input.title });
    return row;
  });
}

export async function updateLeadershipProfile(sql: postgres.Sql, actorId: string, id: string, expectedRevision: number, raw: unknown) {
  const actor = uuid(actorId);
  const profileId = uuid(id);
  const revision = revisionInput.parse(expectedRevision);
  const input = leadershipInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`update content.leadership_profiles set member_id=${input.memberId ?? null}, display_name=${input.displayName},
      title=${input.title}, biography=${input.biography}, image_id=${input.imageId ?? null}, sort_order=${input.sortOrder}, published=${input.published}, revision=revision+1
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
