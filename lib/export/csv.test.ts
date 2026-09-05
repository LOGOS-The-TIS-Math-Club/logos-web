import { describe, expect, it } from "vitest";

import { csvDate, toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes every cell and separates rows with CRLF", () => {
    const csv = toCsv(["A", "B"], [["1", "2"]]);

    expect(csv).toBe('"A","B"\r\n"1","2"\r\n');
  });

  it("ends with a newline so POSIX tools do not see a truncated file", () => {
    expect(toCsv(["A"], [["1"]]).endsWith("\r\n")).toBe(true);
  });

  it("escapes embedded quotes by doubling them", () => {
    expect(toCsv(["A"], [['say "hi"']])).toContain('"say ""hi"""');
  });

  it("keeps a comma inside a cell from splitting the row", () => {
    const csv = toCsv(["A", "B"], [["one,two", "three"]]);

    expect(csv).toBe('"A","B"\r\n"one,two","three"\r\n');
  });

  it.each(["=cmd()", "+1", "-1", "@SUM(A1)"])(
    "neutralises %s so a spreadsheet does not execute it",
    (payload) => {
      // These files are opened in Excel or Sheets by definition, so a leading
      // formula character is an actual attack surface, not a hypothetical one.
      expect(toCsv(["A"], [[payload]])).toContain(`"'${payload}"`);
    },
  );

  it("renders null and undefined as empty cells", () => {
    expect(toCsv(["A", "B"], [[null, undefined]])).toBe('"A","B"\r\n"",""\r\n');
  });

  it("emits headers alone when there are no rows", () => {
    expect(toCsv(["A", "B"], [])).toBe('"A","B"\r\n');
  });
});

describe("csvDate", () => {
  it("renders a Date as an ISO instant", () => {
    expect(csvDate(new Date("2026-09-04T06:30:00.000Z"))).toBe(
      "2026-09-04T06:30:00.000Z",
    );
  });

  it("passes a date string through unchanged", () => {
    expect(csvDate("2026-09-04")).toBe("2026-09-04");
  });

  it("renders null and undefined as empty", () => {
    expect(csvDate(null)).toBe("");
    expect(csvDate(undefined)).toBe("");
  });
});
