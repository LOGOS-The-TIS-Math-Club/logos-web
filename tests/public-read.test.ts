import assert from "node:assert/strict";
import test from "node:test";
import { readPublic } from "../src/content/public-read.ts";

test("public content distinguishes an empty list and an unconfigured singleton from an outage", async () => {
  assert.deepEqual(await readPublic(async () => []), {
    status: "available",
    data: [],
  });
  assert.deepEqual(await readPublic(async () => null), {
    status: "available",
    data: null,
  });
  assert.deepEqual(
    await readPublic(async () => {
      throw new Error("private connection details");
    }),
    { status: "unavailable" },
  );
});

test("a synchronous configuration failure is safe and does not hide another readable section", async () => {
  const [failed, readable] = await Promise.all([
    readPublic(() => {
      throw new Error("private setup details");
    }),
    readPublic(async () => ["Published title"]),
  ]);
  assert.deepEqual(failed, { status: "unavailable" });
  assert.deepEqual(readable, {
    status: "available",
    data: ["Published title"],
  });
  assert.ok(!JSON.stringify([failed, readable]).includes("private"));
});
