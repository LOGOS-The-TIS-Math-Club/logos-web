import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { createApi } from "../src/server/api.ts";
import { updateStory } from "../src/content/operations.ts";
import { BackendError } from "../src/server/errors.ts";

const origin = "https://club.example.test";
const upload = {
  base64: "R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
  mimeType: "image/gif",
  altText: "Synthetic one-pixel image",
};

export async function verifyContentReplay(sql: postgres.Sql, allowDdl = true) {
  const [admin] =
    await sql`insert into people.identities(email,school_verified) values ('replay-admin@tokyois.com',true) returning id`;
  const [otherAdmin] =
    await sql`insert into people.identities(email,school_verified) values ('replay-other@tokyois.com',true) returning id`;
  const [member] =
    await sql`insert into people.identities(email,school_verified) values ('replay-member@tokyois.com',true) returning id`;
  await sql`insert into people.role_grants(identity_id,role) values (${admin.id},'admin'),(${otherAdmin.id},'admin')`;
  const asActor = (id: string, isAdmin: boolean) =>
    createApi({
      sql,
      appUrl: origin,
      currentUser: async () => ({
        id,
        email: "synthetic@tokyois.com",
        admin: isAdmin,
        member: false,
      }),
    });
  const api = asActor(admin.id, true);
  const otherApi = asActor(otherAdmin.id, true);
  const memberApi = asActor(member.id, false);
  const anonymousApi = createApi({
    sql,
    appUrl: origin,
    currentUser: async () => {
      throw new BackendError("UNAUTHENTICATED", "Sign in required", 401);
    },
  });
  const send = (kind: string, body: unknown, handler = api) =>
    handler(
      new Request(`${origin}/api/admin/content/${kind}`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const result = async (response: Response) => {
    assert.equal(response.status, 201, await response.clone().text());
    return (await response.json()).data;
  };
  const count = async (table: string) =>
    Number((await sql`select count(*) as n from ${sql(table)}`)[0].n);
  const story = {
    requestId: randomUUID(),
    title: "Sequential retry",
    occurredOn: "2038-08-20",
  };
  assert.equal(
    (
      await send("stories", {
        title: "Missing ID",
        occurredOn: story.occurredOn,
      })
    ).status,
    400,
  );
  assert.equal(
    (await send("stories", { ...story, requestId: "invalid" })).status,
    400,
  );
  assert.equal((await send("stories", story, anonymousApi)).status, 401);
  assert.equal((await send("stories", story, memberApi)).status, 403);
  assert.equal(await count("operations.content_creations"), 0);

  // Sequential retry and canonical ID spelling return the original JSON snapshot.
  const original = await result(await send("stories", story));
  assert.equal(original.description, "");
  assert.deepEqual(
    await result(
      await send("stories", {
        ...story,
        requestId: story.requestId.toUpperCase(),
      }),
    ),
    original,
  );
  assert.equal(await count("content.stories"), 1);
  assert.equal(await count("operations.content_creations"), 1);
  await updateStory(sql, admin.id, original.id, original.revision, {
    title: "Edited after creation",
    occurredOn: story.occurredOn,
    published: true,
  });
  assert.deepEqual(await result(await send("stories", story)), original);
  assert.equal(
    (await sql`select title from content.stories where id=${original.id}`)[0]
      .title,
    "Edited after creation",
  );

  // The response is discarded after the server commits, modeling a lost response.
  const lost = {
    ...story,
    requestId: randomUUID(),
    title: "Lost response retry",
    upload,
  };
  const beforeLostImages = await count("content.images");
  const lostResponse = await send("stories", lost);
  assert.equal(lostResponse.status, 201);
  await lostResponse.body?.cancel();
  const [committed] =
    await sql`select id,image_id from content.stories where title=${lost.title}`;
  const recovered = await result(await send("stories", lost));
  assert.equal(recovered.id, committed.id);
  assert.equal(recovered.image_id, committed.image_id);
  assert.equal(await count("content.images"), beforeLostImages + 1);
  assert.equal(
    Number(
      (
        await sql`select count(*) as n from content.stories where title=${lost.title}`
      )[0].n,
    ),
    1,
  );

  // Different UUID spelling for the same existing image remains the same input.
  const reference = {
    ...story,
    requestId: randomUUID(),
    title: "Existing image reference",
    imageId: recovered.image_id,
  };
  const referenced = await result(await send("stories", reference));
  assert.deepEqual(
    await result(
      await send("stories", {
        ...reference,
        imageId: reference.imageId.toUpperCase(),
      }),
    ),
    referenced,
  );

  // Independent DB transactions race on the same logical save, including upload.
  const concurrent = {
    ...story,
    requestId: randomUUID(),
    title: "Concurrent image save",
    upload,
  };
  const beforeImages = await count("content.images");
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => send("stories", concurrent)),
  );
  const saved = await Promise.all(responses.map(result));
  for (const row of saved) assert.deepEqual(row, saved[0]);
  assert.equal(await count("content.images"), beforeImages + 1);
  assert.equal(
    Number(
      (
        await sql`select count(*) as n from content.stories where title=${concurrent.title}`
      )[0].n,
    ),
    1,
  );
  assert.equal(
    Number(
      (
        await sql`select count(*) as n from operations.change_history where entity_id=${saved[0].id} and action='content.story.created'`
      )[0].n,
    ),
    1,
  );

  // Content, image metadata, and actual image bytes all participate in conflicts.
  for (const changed of [
    { ...concurrent, title: "Different" },
    { ...concurrent, upload: { ...upload, altText: "Different alt text" } },
    {
      ...concurrent,
      upload: {
        ...upload,
        base64: Buffer.concat([
          Buffer.from(upload.base64, "base64"),
          Buffer.from([0]),
        ]).toString("base64"),
      },
    },
    { ...concurrent, upload: undefined },
  ]) {
    const response = await send("stories", changed);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "CONFLICT");
  }
  assert.equal(await count("content.images"), beforeImages + 1);

  // Concurrent conflicting payloads must have one winner, never two creations.
  const conflictId = randomUUID();
  const conflictImages = await count("content.images");
  const competing = await Promise.all([
    send("stories", {
      ...concurrent,
      requestId: conflictId,
      title: "Conflicting A",
    }),
    send("stories", {
      ...concurrent,
      requestId: conflictId,
      title: "Conflicting B",
    }),
  ]);
  assert.deepEqual(
    competing.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.equal(await count("content.images"), conflictImages + 1);
  assert.equal(
    Number(
      (
        await sql`select count(*) as n from operations.content_creations where actor_id=${admin.id} and request_id=${conflictId}`
      )[0].n,
    ),
    1,
  );

  // One ID belongs to an actor+operation, not a title/date or a global client ID.
  const separate = await result(
    await send("stories", { ...concurrent, requestId: randomUUID() }),
  );
  assert.notEqual(separate.id, saved[0].id);
  assert.equal(separate.title, saved[0].title);
  const otherActor = await result(await send("stories", concurrent, otherApi));
  assert.notEqual(otherActor.id, saved[0].id);
  const announcement = {
    requestId: concurrent.requestId,
    title: concurrent.title,
    body: "Announcement",
    upload,
  };
  const announcementSaved = await result(
    await send("announcements", announcement),
  );
  assert.deepEqual(
    await result(await send("announcements", announcement)),
    announcementSaved,
  );

  // Equivalent create paths all require and honor the same replay contract.
  for (const [kind, payload] of [
    ["leadership", { displayName: "Synthetic Leader", title: "President" }],
    [
      "resources",
      { title: "Synthetic resource", url: "https://example.invalid/resource" },
    ],
    [
      "club-info",
      { about: "Synthetic club", contactEmail: "mathclub@tokyois.com" },
    ],
    ["images", { upload }],
  ] as const) {
    const body = { ...payload, requestId: randomUUID() };
    const first = await result(await send(kind, body));
    assert.deepEqual(await result(await send(kind, body)), first);
    const changed =
      kind === "images"
        ? { ...body, upload: { ...upload, altText: "Changed" } }
        : kind === "club-info"
          ? { ...body, about: "Changed" }
          : { ...body, title: "Changed" };
    assert.equal((await send(kind, changed)).status, 409);
  }

  // Replays must not disclose a stored admin result after permission revocation.
  await sql`delete from people.role_grants where identity_id=${admin.id} and role='admin'`;
  assert.equal((await send("stories", story)).status, 403);
  await sql`insert into people.role_grants(identity_id,role) values(${admin.id},'admin')`;

  // Validation failures do not reserve the ID; corrected data can retry it.
  const invalid = {
    ...story,
    requestId: randomUUID(),
    title: "Validation retry",
    upload: { ...upload, mimeType: "image/png" },
  };
  assert.equal((await send("stories", invalid)).status, 400);
  assert.equal(
    Number(
      (
        await sql`select count(*) as n from operations.content_creations where request_id=${invalid.requestId}`
      )[0].n,
    ),
    0,
  );
  assert.ok(
    (await result(await send("stories", { ...invalid, upload }))).image_id,
  );

  if (allowDdl) {
    // Failure after inserting image, Story, and history must also roll back receipt.
    const retry = {
      ...story,
      requestId: randomUUID(),
      title: "Rollback then retry",
      upload,
    };
    const countsBefore = await Promise.all(
      [
        "content.images",
        "content.stories",
        "operations.content_creations",
        "operations.change_history",
      ].map(count),
    );
    await sql.unsafe(
      `create function operations.fail_replay_receipt() returns trigger language plpgsql as $$ begin raise exception 'injected failure' using errcode='23514'; end; $$; create trigger fail_replay_receipt before insert on operations.content_creations for each row execute function operations.fail_replay_receipt();`,
    );
    try {
      assert.equal((await send("stories", retry)).status, 422);
    } finally {
      await sql.unsafe(
        "drop trigger fail_replay_receipt on operations.content_creations; drop function operations.fail_replay_receipt();",
      );
    }
    assert.deepEqual(
      await Promise.all(
        [
          "content.images",
          "content.stories",
          "operations.content_creations",
          "operations.change_history",
        ].map(count),
      ),
      countsBefore,
    );
    const success = await result(await send("stories", retry));
    assert.deepEqual(await result(await send("stories", retry)), success);
  }
}
