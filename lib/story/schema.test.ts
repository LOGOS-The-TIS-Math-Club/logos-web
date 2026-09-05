import { describe, expect, it } from "vitest";

import { StoryEntryInputSchema, UpdateStoryEntrySchema } from "./schema";

describe("UpdateStoryEntrySchema", () => {
  it("does not unpublish an entry when only the title is edited", () => {
    /*
     * Zod applies .default() even through .partial(), so deriving this schema
     * from StoryEntryInputSchema would send published:false on every edit and
     * quietly pull the entry off the public page whenever somebody fixed a
     * typo. Verified against the library, not assumed.
     */
    const parsed = UpdateStoryEntrySchema.parse({ title: "First meeting" });

    expect(parsed).toEqual({ title: "First meeting" });
    expect(parsed).not.toHaveProperty("published");
  });

  it("distinguishes clearing an image from leaving it alone", () => {
    expect(UpdateStoryEntrySchema.parse({ imageId: null })).toEqual({
      imageId: null,
    });
    expect(UpdateStoryEntrySchema.parse({ title: "x" })).not.toHaveProperty(
      "imageId",
    );
  });

  it("rejects an empty edit", () => {
    expect(() => UpdateStoryEntrySchema.parse({})).toThrow(
      /at least one field/i,
    );
  });

  it("rejects a malformed date", () => {
    expect(() =>
      UpdateStoryEntrySchema.parse({ occurredOn: "4 September 2026" }),
    ).toThrow();
  });

  it("rejects an image id that is not a uuid", () => {
    expect(() =>
      UpdateStoryEntrySchema.parse({ imageId: "../../etc/passwd" }),
    ).toThrow();
  });
});

describe("StoryEntryInputSchema", () => {
  it("defaults a new entry to unpublished", () => {
    // Writing an entry and having it appear publicly in the same keystroke is
    // the wrong default for a record about real students.
    const parsed = StoryEntryInputSchema.parse({
      title: "First meeting",
      body: "Fifteen students turned up.",
      occurredOn: "2026-09-04",
    });

    expect(parsed.published).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(
      StoryEntryInputSchema.parse({
        title: "  First meeting  ",
        body: "  Something happened.  ",
        occurredOn: "2026-09-04",
      }).title,
    ).toBe("First meeting");
  });
});
