import test from "node:test";
import assert from "node:assert/strict";
import { adminRequest, AdminRequestError } from "../src/admin/request.ts";

test("leadership validation keeps structured field errors for the form", async (t) => {
  const fields = [{ field: "displayName", message: "Enter a display name" }];
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: { message: "Check the submitted fields.", fields } },
      { status: 400 },
    ),
  );
  await assert.rejects(
    adminRequest("/api/admin/members/example", "PUT", {}),
    (error) =>
      error instanceof AdminRequestError &&
      error.status === 400 &&
      error.fields?.[0].field === "displayName",
  );
});
test("unreadable and internal responses have safe recovery errors", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>Private infrastructure details</html>", {
        status: 502,
      }),
  );
  await assert.rejects(
    adminRequest("/api/admin/content/stories", "POST", {}),
    (error) =>
      error instanceof AdminRequestError &&
      error.status === 503 &&
      !error.message.includes("Private"),
  );
  fetchMock.mock.mockImplementation(async () =>
    Response.json(
      { error: { message: "Private SQL details" } },
      { status: 503 },
    ),
  );
  await assert.rejects(
    adminRequest("/api/admin/content/stories", "POST", {}),
    (error) =>
      error instanceof AdminRequestError && !error.message.includes("Private"),
  );
});
test("leadership writes preserve replay payloads and never use shared caches", async (t) => {
  const payload = {
    requestId: "synthetic-test-id",
    title: "Retained title",
    upload: { base64: "same bytes" },
  };
  let sent: RequestInit | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      sent = init;
      return Response.json({ data: { id: "saved" } });
    },
  );
  assert.deepEqual(
    await adminRequest("/api/admin/content/stories", "POST", payload),
    { id: "saved" },
  );
  assert.equal(sent?.cache, "no-store");
  assert.equal(sent?.credentials, "same-origin");
  assert.deepEqual(JSON.parse(String(sent?.body)), payload);
});
