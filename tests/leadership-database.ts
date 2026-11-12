import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { createApi } from "../src/server/api.ts";
import { BackendError } from "../src/server/errors.ts";
export async function verifyLeadership(sql: postgres.Sql) {
  const [admin, student] = await sql<
    { id: string; email: string }[]
  >`insert into people.identities(email,school_verified) values(${`synthetic-leadership-${randomUUID()}@tokyois.com`},true),(${`synthetic-student-${randomUUID()}@tokyois.com`},true) returning id,email`;
  await sql`insert into people.role_grants(identity_id,role) values(${admin.id},'admin')`;
  const origin = "http://localhost:3999";
  const actor = (row: typeof admin, allowed: boolean) =>
    createApi({
      sql,
      appUrl: origin,
      currentUser: async () => ({ ...row, admin: allowed, member: false }),
    });
  const api = actor(admin, true),
    denied = actor(student, false),
    anonymous = createApi({
      sql,
      appUrl: origin,
      currentUser: async () => {
        throw new BackendError("UNAUTHENTICATED", "Sign in", 401);
      },
    });
  const get = (path: string) => new Request(origin + "/api/" + path);
  const put = (body: unknown) =>
    new Request(origin + "/api/admin/recurring-meeting", {
      method: "PUT",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await denied(get("admin/recurring-meeting"))).status, 403);
  assert.equal((await anonymous(get("admin/recurring-meeting"))).status, 401);
  assert.equal(
    (await (await api(get("public/recurring-meeting"))).json()).data,
    null,
  );
  const before =
    await sql`select id,starts_at_local,revision from meetings.sessions order by id`;
  const settings = {
    weekday: 5,
    startTime: "15:30",
    durationMinutes: 60,
    room: "Synthetic room",
    published: false,
    revision: 0,
  };
  assert.equal((await denied(put(settings))).status, 403);
  assert.equal((await api(put({ ...settings, weekday: 7 }))).status, 400);
  assert.equal((await api(put(settings))).status, 200);
  assert.equal(
    (await (await api(get("public/recurring-meeting"))).json()).data,
    null,
  );
  assert.equal((await api(put({ ...settings, published: true }))).status, 409);
  const outcomes = await Promise.all([
    api(put({ ...settings, published: true, revision: 1 })),
    api(put({ ...settings, published: true, revision: 1 })),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  const projection = (
    await (await anonymous(get("public/recurring-meeting"))).json()
  ).data;
  assert.deepEqual(projection, {
    weekday: 5,
    startTime: "15:30",
    durationMinutes: 60,
    room: "Synthetic room",
  });
  assert.deepEqual(Object.keys(projection).sort(), [
    "durationMinutes",
    "room",
    "startTime",
    "weekday",
  ]);
  assert.equal((await api(put({ ...settings, revision: 2 }))).status, 200);
  assert.equal(
    (await (await api(get("public/recurring-meeting"))).json()).data,
    null,
  );
  assert.deepEqual(
    await sql`select id,starts_at_local,revision from meetings.sessions order by id`,
    before,
  );
  // Profile images use the same atomic content replay contract as stories.
  const body = {
    requestId: randomUUID(),
    displayName: "Synthetic profile",
    title: "Synthetic leader",
    published: false,
    upload: {
      base64: "R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
      mimeType: "image/gif",
      altText: "Synthetic image",
    },
  };
  const post = () =>
    new Request(origin + "/api/admin/content/leadership", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const first = await api(post());
  assert.equal(first.status, 201, await first.clone().text());
  const created = (await first.json()).data;
  assert.ok(created.image_id);
  const repeat = await api(post());
  assert.equal(repeat.status, 201);
  assert.deepEqual((await repeat.json()).data, created);
  const image = await anonymous(get("public/images/" + created.image_id));
  assert.equal(image.status, 404);
  const writeContent = (path: string, method: string, data: unknown) =>
    api(new Request(origin + "/api/admin/content/" + path, {
      method, headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }));
  const uploads = ["First image", "Second image"].map(altText => ({ ...body.upload, altText }));
  for (const kind of ["stories", "announcements"] as const) {
    const postBody = {
      requestId: randomUUID(),
      title: "Synthetic gallery",
      ...(kind === "stories" ? { occurredOn: "2026-11-12" } : { body: "Synthetic notice" }),
      uploads,
    };
    const saved = await writeContent(kind, "POST", postBody);
    assert.equal(saved.status, 201, await saved.clone().text());
    const postRow = (await saved.json()).data;
    const path = kind + "/" + postRow.id;
    assert.equal((await writeContent(kind, "POST", postBody)).status, 201);
    assert.equal((await writeContent(kind, "POST", { ...postBody, uploads: uploads.toReversed() })).status, 409);
    const detail = async () => (await (await api(get("admin/content/" + path))).json()).data;
    const draftImages = (await detail()).additional_images;
    assert.deepEqual(draftImages.map((item: { alt: string }) => item.alt), ["First image", "Second image"]);
    assert.equal((await anonymous(get("public/images/" + draftImages[0].id))).status, 404);

    const edit = { ...postBody, revision: postRow.revision, published: true, removeImageIds: [draftImages[0].id] };
    const [beforeImages] = await sql`select count(*)::int as n from content.images`;
    const failed = await writeContent(path, "PUT", {
      ...edit, uploads: [uploads[0], { ...uploads[1], base64: "AAAA" }],
    });
    assert.equal(failed.status, 400);
    assert.equal((await sql`select count(*)::int as n from content.images`)[0].n, beforeImages.n);
    assert.deepEqual((await detail()).additional_images, draftImages);
    assert.equal((await detail()).revision, postRow.revision);

    const published = await writeContent(path, "PUT", { ...edit, uploads: [uploads[0]] });
    assert.equal(published.status, 200, await published.clone().text());
    const list = (await (await anonymous(get("public/" + kind))).json()).data;
    const projection = list.find((item: { id: string }) => item.id === postRow.id);
    assert.deepEqual(projection.additional_images.map((item: { alt: string }) => item.alt), ["Second image", "First image"]);
    assert.equal((await anonymous(get("public/images/" + draftImages[0].id))).status, 404);
    assert.equal((await anonymous(get("public/images/" + draftImages[1].id))).status, 200);
  }
  const queue = await api(get("admin/applications?offset=not-a-number"));
  assert.equal(queue.status, 400);
}
