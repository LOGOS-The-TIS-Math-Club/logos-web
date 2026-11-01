import assert from "node:assert/strict";
import test from "node:test";
import {
  readHomepage,
  formatPublicationDate,
} from "../src/content/homepage.ts";

test("an unavailable noticeboard preserves an independently readable term focus", async () => {
  const content = await readHomepage({
    sessions: async () => ({ latest: null, termTitles: [] }),
    announcements: () => {
      throw new Error("private infrastructure details");
    },
    clubInfo: async () => ({ semester_focus: "  Algebraic structure  " }),
  });
  assert.deepEqual(content.announcements, { status: "unavailable" });
  assert.deepEqual(content.focus, {
    status: "available",
    data: "Algebraic structure",
  });
  assert.ok(
    !JSON.stringify(content).includes("private infrastructure details"),
  );
});

test("empty published content differs from a failed read, without falling back to legacy records", async () => {
  const content = await readHomepage({
    sessions: async () => ({ latest: null, termTitles: [] }),
    announcements: async () => [],
    clubInfo: async () => null,
  });
  assert.deepEqual(content.announcements, { status: "available", data: [] });
  assert.deepEqual(content.focus, { status: "available", data: null });
  const partial = await readHomepage({
    sessions: async () => ({ latest: null, termTitles: [] }),
    announcements: async () => [],
    clubInfo: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(partial.announcements.status, "available");
  assert.equal(partial.focus.status, "unavailable");
});

test("announcement publication dates follow Tokyo across a UTC date boundary", () => {
  assert.equal(
    formatPublicationDate(new Date("2026-10-31T15:00:00Z")),
    "1 Nov 2026",
  );
});

test("session failures preserve public content and never become an empty programme", async () => {
  const content = await readHomepage({
    sessions: async () => {
      throw new Error("private session infrastructure details");
    },
    announcements: async () => [],
    clubInfo: async () => ({ semester_focus: "Proofs" }),
  });
  assert.deepEqual(content.sessions, { status: "unavailable" });
  assert.equal(content.focus.status, "available");
  assert.equal(content.announcements.status, "available");
  assert.ok(
    !JSON.stringify(content).includes("private session infrastructure details"),
  );
});

test("session summaries preserve an unconfigured term separately from an empty one", async () => {
  for (const termTitles of [null, []]) {
    const data = {
      latest: { title: "Proofs", description: "Induction" },
      termTitles,
    };
    const content = await readHomepage({
      sessions: async () => data,
      announcements: async () => [],
      clubInfo: async () => null,
    });
    assert.deepEqual(content.sessions, { status: "available", data });
  }
});
