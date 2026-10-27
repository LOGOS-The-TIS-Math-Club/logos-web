import test from "node:test";
import assert from "node:assert/strict";
import { creationHash } from "../src/content/replay.ts";
import { creationRequestInput, storyInput, leadershipInput } from "../src/content/input.ts";

test("content replay input requires a UUID and canonicalizes its spelling", () => {
  const id = "B63C406D-39BE-48BA-8AD4-BF10ED54AEFC";
  assert.equal(
    creationRequestInput.parse({ requestId: id }).requestId,
    id.toLowerCase(),
  );
  assert.equal(creationRequestInput.safeParse({}).success, false);
  assert.equal(
    creationRequestInput.safeParse({ requestId: "save-1" }).success,
    false,
  );
});
test("creation fingerprints ignore object order and cover effective content", () => {
  assert.equal(
    creationHash({ a: 1, b: { c: 2, d: 3 } }),
    creationHash({ b: { d: 3, c: 2 }, a: 1 }),
  );
  assert.notEqual(
    creationHash({ title: "One" }),
    creationHash({ title: "Two" }),
  );
  assert.notEqual(
    creationHash({ upload: { sha256: "one" } }),
    creationHash({ upload: { sha256: "two" } }),
  );
  assert.equal(
    creationHash(
      storyInput.parse({ title: "Story", occurredOn: "2038-08-20" }),
    ),
    creationHash(
      storyInput.parse({
        title: "Story",
        occurredOn: "2038-08-20",
        description: "",
        published: false,
      }),
    ),
  );
});

test("reference UUID spellings describe the same effective content", () => {
  const id = "B63C406D-39BE-48BA-8AD4-BF10ED54AEFC";
  assert.equal(
    storyInput.parse({ title: "Story", occurredOn: "2038-08-20", imageId: id })
      .imageId,
    id.toLowerCase(),
  );
  const profile = leadershipInput.parse({
    displayName: "Leader",
    title: "President",
    memberId: id,
    imageId: id,
  });
  assert.equal(profile.memberId, id.toLowerCase());
  assert.equal(profile.imageId, id.toLowerCase());
});
