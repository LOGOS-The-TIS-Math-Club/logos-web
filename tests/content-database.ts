import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  createAnnouncement,
  createClubInfo,
  createImage,
  createLeadershipProfile,
  createResource,
  createStory,
  getAdminAnnouncement,
  getAdminClubInfo,
  getClubInfo,
  getAdminImage,
  getAdminLeadershipProfile,
  getAdminResource,
  getAdminStory,
  getPublicImage,
  listAdminAnnouncements,
  listAdminLeadership,
  listAdminResources,
  listAdminStories,
  getPublishedAnnouncements,
  getPublishedLeadership,
  getPublishedStories,
  getResources,
  updateResource,
  updateStory,
  updateClubInfo,
} from "../src/content/operations.ts";

export async function verifyContent(sql: postgres.Sql) {
  const suffix = randomUUID();
  const [admin] = await sql`insert into people.identities(email, school_verified)
    values (${`content-admin-${suffix}@tokyois.com`}, true) returning id`;
  const [member] = await sql`insert into people.identities(email, school_verified)
    values (${`content-member-${suffix}@tokyois.com`}, true) returning id`;
  await sql`insert into people.role_grants(identity_id, role) values (${admin.id}, 'admin')`;
  const expectCode = async (promise: PromiseLike<unknown>, code: string) => {
    await assert.rejects(Promise.resolve(promise), (error: unknown) => (error as { code: string }).code === code);
  };

  await expectCode(createStory(sql, member.id, { requestId: randomUUID(), title: "Forbidden", occurredOn: "2026-10-25" }), "42501");
  const draft = await createStory(sql, admin.id, { requestId: randomUUID(), title: "Draft", occurredOn: "2026-10-25" }, {
    data: Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64"),
    mimeType: "image/gif",
    altText: "One pixel",
  });
  assert.ok(draft.image_id);
  assert.equal((await sql`select count(*)::int as n from content.images where id=${draft.image_id}`)[0].n, 1);
  await expectCode(getPublicImage(sql, draft.image_id), "NOT_FOUND");
  assert.equal((await getAdminImage(sql, admin.id, draft.image_id)).mime_type, "image/gif");
  assert.ok((await listAdminStories(sql, admin.id)).some((row) => row.id === draft.id));
  assert.equal((await getAdminStory(sql, admin.id, draft.id)).revision, draft.revision);
  await expectCode(getAdminImage(sql, member.id, draft.image_id), "42501");
  const privateImage = await createImage(sql, admin.id, { requestId: randomUUID(),
    data: Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64"),
    mimeType: "image/gif",
    altText: "Unlinked private image",
  });
  await expectCode(getPublicImage(sql, privateImage.id), "NOT_FOUND");
  const published = await createStory(sql, admin.id, { requestId: randomUUID(), title: "Published", occurredOn: "2026-10-24", published: true });
  assert.deepEqual((await getPublishedStories(sql)).map((row) => row.id), [published.id]);
  const revised = await updateStory(sql, admin.id, published.id, published.revision, {
    title: "Updated story", occurredOn: "2026-10-24", description: "Reviewed", published: true,
  });
  assert.equal(revised.revision, published.revision + 1);
  const visibleDraft = await updateStory(sql, admin.id, draft.id, draft.revision, {
    title: "Published draft", occurredOn: "2026-10-25", published: true,
  });
  assert.equal((await getPublicImage(sql, draft.image_id))?.id, draft.image_id);
  await expectCode(updateStory(sql, admin.id, published.id, published.revision, {
    title: "Stale story", occurredOn: "2026-10-24", published: true,
  }), "CONFLICT");
  await expectCode(updateStory(sql, admin.id, randomUUID(), 1, {
    title: "Missing", occurredOn: "2026-10-24",
  }), "NOT_FOUND");

  const announcement = await createAnnouncement(sql, admin.id, { requestId: randomUUID(), title: "Notice", body: "Published", published: true });
  assert.deepEqual((await getPublishedAnnouncements(sql)).map((row) => row.id), [announcement.id]);
  assert.ok((await listAdminAnnouncements(sql, admin.id)).some((row) => row.id === announcement.id));
  assert.equal((await getAdminAnnouncement(sql, admin.id, announcement.id)).revision, announcement.revision);
  const leader = await createLeadershipProfile(sql, admin.id, { requestId: randomUUID(),
    displayName: "Ada", title: "President", published: true,
  });
  assert.deepEqual((await getPublishedLeadership(sql)).map((row) => row.id), [leader.id]);
  assert.ok((await listAdminLeadership(sql, admin.id)).some((row) => row.id === leader.id));
  assert.equal((await getAdminLeadershipProfile(sql, admin.id, leader.id)).revision, leader.revision);
  const importedResource = (await sql`insert into content.resource_links(title, url)
    values ('Imported handbook', 'https://example.com/imported') returning *`)[0];
  const hiddenResource = await createResource(sql, admin.id, { requestId: randomUUID(), title: "Draft handbook", url: "https://example.com/draft" });
  const resource = await createResource(sql, admin.id, { requestId: randomUUID(),
    title: "Handbook", url: "https://example.com/handbook", published: true,
  });
  assert.deepEqual((await getResources(sql)).map((row) => row.id), [resource.id]);
  const adminResources = await listAdminResources(sql, admin.id);
  assert.ok(adminResources.some((row) => row.id === resource.id && row.published));
  assert.ok(adminResources.some((row) => row.id === hiddenResource.id && !row.published));
  assert.equal((await getAdminResource(sql, admin.id, importedResource.id)).published, false);
  assert.equal((await getAdminResource(sql, admin.id, resource.id)).revision, resource.revision);
  const publishedDraft = await updateResource(sql, admin.id, hiddenResource.id, hiddenResource.revision, {
    title: "Published draft handbook", url: "https://example.com/draft", published: true,
  });
  assert.equal(publishedDraft.revision, hiddenResource.revision + 1);
  assert.deepEqual(new Set((await getResources(sql)).map((row) => row.id)), new Set([resource.id, hiddenResource.id]));
  const hiddenAgain = await updateResource(sql, admin.id, hiddenResource.id, publishedDraft.revision, {
    title: "Private handbook", url: "https://example.com/draft", published: false,
  });
  assert.equal(hiddenAgain.published, false);
  assert.deepEqual((await getResources(sql)).map((row) => row.id), [resource.id]);
  assert.deepEqual((await getResources(sql)).map((row) => row.id).includes(importedResource.id), false);

  const club = await createClubInfo(sql, admin.id, { requestId: randomUUID(),
    about: "Math club", semesterFocus: "Proofs", contactEmail: "mathclub@example.com",
  });
  assert.equal((await getClubInfo(sql))?.about, club.about);
  assert.equal((await getAdminClubInfo(sql, admin.id))?.revision, club.revision);
  const updatedClub = await updateClubInfo(sql, admin.id, club.revision, {
    about: "Updated math club", semesterFocus: "Geometry", contactEmail: "mathclub@example.com",
  });
  assert.equal(updatedClub.revision, club.revision + 1);
  assert.equal(draft.published, false);
  const history = await sql`select action from operations.change_history where entity_id in (${draft.id}, ${published.id}, ${announcement.id}, ${leader.id}, ${resource.id}, ${hiddenResource.id})`;
  assert.ok(history.length >= 7);
}
