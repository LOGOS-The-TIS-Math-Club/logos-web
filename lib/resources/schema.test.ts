import { describe, expect, it } from "vitest";

import { ResourceInputSchema, UpdateResourceSchema } from "./schema";

describe("UpdateResourceSchema", () => {
  it("does not reorder a card when only the title is edited", () => {
    const parsed = UpdateResourceSchema.parse({ title: "Classroom" });

    /*
     * Zod applies .default() even through .partial(), which was verified
     * against the real library rather than assumed: deriving this schema from
     * ResourceInputSchema produced { title, sortOrder: 0 } and would have
     * silently moved the card to the front on every title edit.
     */
    expect(parsed).toEqual({ title: "Classroom" });
    expect(parsed).not.toHaveProperty("sortOrder");
  });

  it("still defaults sortOrder when creating", () => {
    const created = ResourceInputSchema.parse({
      title: "Drive",
      description: "Archive",
      url: "https://drive.google.com/drive/folders/abc",
    });

    expect(created.sortOrder).toBe(0);
  });

  it("rejects an empty edit", () => {
    expect(() => UpdateResourceSchema.parse({})).toThrow(/at least one field/i);
  });
});

describe("resource link validation", () => {
  const base = { title: "T", description: "D" };

  it.each([
    ["javascript:alert(1)", "script URL"],
    ["data:text/html,<script>alert(1)</script>", "data URL"],
    ["http://example.com/insecure", "plain http"],
    ["not a url at all", "malformed"],
  ])("rejects %s (%s)", (url) => {
    expect(() => ResourceInputSchema.parse({ ...base, url })).toThrow();
  });

  it("accepts an https link", () => {
    expect(
      ResourceInputSchema.parse({
        ...base,
        url: "https://classroom.google.com/c/abc",
      }).url,
    ).toBe("https://classroom.google.com/c/abc");
  });
});
