import { describe, expect, it } from "vitest";

import { CreateSessionSchema, UpdateSessionSchema } from "./schema";

describe("UpdateSessionSchema", () => {
  it("leaves omitted fields absent instead of filling in defaults", () => {
    const parsed = UpdateSessionSchema.parse({ title: "Projective geometry" });

    /*
     * This is the whole reason the schema is written out rather than derived
     * as CreateSessionSchema.partial(): that schema carries .default() on the
     * room and the times, so a partial edit of the topic would silently move
     * the session back to Room 101 at 15:30.
     */
    expect(parsed).toEqual({ title: "Projective geometry" });
    expect(parsed).not.toHaveProperty("location");
    expect(parsed).not.toHaveProperty("startTime");
  });

  it("demonstrates the defaults that made .partial() unsafe here", () => {
    const created = CreateSessionSchema.parse({ sessionDate: "2026-10-02" });

    expect(created.location).toBe("Room 101");
    expect(created.startTime).toBe("15:30");
  });

  it("accepts a null note so an existing note can be cleared", () => {
    expect(UpdateSessionSchema.parse({ notes: null })).toEqual({ notes: null });
  });

  it("rejects an empty edit rather than writing nothing", () => {
    expect(() => UpdateSessionSchema.parse({})).toThrow(
      /at least one field to update/i,
    );
  });

  it("rejects a malformed date", () => {
    expect(() =>
      UpdateSessionSchema.parse({ sessionDate: "4 Oct 2026" }),
    ).toThrow();
  });

  it("rejects a topic beyond the column's length check", () => {
    expect(() =>
      UpdateSessionSchema.parse({ title: "x".repeat(121) }),
    ).toThrow();
  });
});
