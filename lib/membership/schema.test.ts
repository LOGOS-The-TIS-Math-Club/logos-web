import { describe, expect, it } from "vitest";

import { UpdateMemberMetadataSchema } from "./schema";

describe("UpdateMemberMetadataSchema", () => {
  it("distinguishes an absent key from an explicit null", () => {
    /*
     * These mean different things: absent leaves the value alone, null clears
     * the override. A form that could only set and never clear would leave a
     * mistyped grade override stuck forever.
     */
    expect(UpdateMemberMetadataSchema.parse({ rosterName: "Chen" })).toEqual({
      rosterName: "Chen",
    });
    expect(UpdateMemberMetadataSchema.parse({ gradeOverride: null })).toEqual({
      gradeOverride: null,
    });
  });

  it("does not fill in fields that were not sent", () => {
    const parsed = UpdateMemberMetadataSchema.parse({ cohortYear: 2026 });

    expect(parsed).not.toHaveProperty("rosterName");
    expect(parsed).not.toHaveProperty("gradeOverride");
  });

  it("has no displayName field, which belongs to the member", () => {
    const parsed = UpdateMemberMetadataSchema.parse({
      rosterName: "Chen",
      displayName: "Something else",
    } as Record<string, unknown>);

    expect(parsed).not.toHaveProperty("displayName");
  });

  it("rejects an empty edit rather than writing nothing", () => {
    expect(() => UpdateMemberMetadataSchema.parse({})).toThrow(
      /at least one field/i,
    );
  });

  it.each([1999, 2101, 1.5])(
    "rejects an implausible cohort year %s",
    (year) => {
      expect(() =>
        UpdateMemberMetadataSchema.parse({ cohortYear: year }),
      ).toThrow();
    },
  );

  it("accepts a plausible cohort year", () => {
    expect(UpdateMemberMetadataSchema.parse({ cohortYear: 2026 })).toEqual({
      cohortYear: 2026,
    });
  });

  it("trims a roster name and rejects a blank one", () => {
    expect(
      UpdateMemberMetadataSchema.parse({ rosterName: "  Chen  " }),
    ).toEqual({ rosterName: "Chen" });
    expect(() =>
      UpdateMemberMetadataSchema.parse({ rosterName: "   " }),
    ).toThrow();
  });
});
