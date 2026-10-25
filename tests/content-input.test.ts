import assert from "node:assert/strict";
import { test } from "node:test";
import {
  announcementInput,
  clubInfoInput,
  imageInput,
  leadershipInput,
  resourceInput,
  storyInput,
} from "../src/content/input.ts";

test("content inputs trim values and enforce source field bounds", () => {
  assert.equal(storyInput.parse({ title: " Story ", occurredOn: "2026-10-25" }).title, "Story");
  assert.equal(storyInput.safeParse({ title: "", occurredOn: "2026-10-25" }).success, false);
  assert.equal(storyInput.safeParse({ title: "Story", occurredOn: "2026-02-30" }).success, false);
  assert.equal(announcementInput.safeParse({ title: "A", body: " " }).success, false);
  assert.equal(leadershipInput.safeParse({ displayName: "Name", title: "Role", published: "yes" }).success, false);
  assert.equal(resourceInput.safeParse({ title: "Docs", url: "http://example.com" }).success, false);
  assert.equal(resourceInput.safeParse({ title: "Docs", url: "https://example.com/path" }).success, true);
  assert.equal(resourceInput.parse({ title: "Docs", url: "https://example.com/path" }).published, false);
  assert.equal(clubInfoInput.safeParse({ about: "", semesterFocus: "", contactEmail: "not-email" }).success, false);
});

test("image input bounds declared binary size and MIME type", () => {
  assert.equal(imageInput.safeParse({ data: new Uint8Array([1]), mimeType: "image/png", altText: "Chart" }).success, true);
  assert.equal(imageInput.safeParse({ data: new Uint8Array(0), mimeType: "image/png", altText: "Chart" }).success, false);
  assert.equal(imageInput.safeParse({ data: new Uint8Array(2_097_153), mimeType: "image/png", altText: "Chart" }).success, false);
  assert.equal(imageInput.safeParse({ data: new Uint8Array([1]), mimeType: "image/svg+xml", altText: "Chart" }).success, false);
});
