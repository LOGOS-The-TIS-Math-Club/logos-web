import { describe, expect, it } from "vitest";

import { DATASET_LABELS, EXPORT_DATASETS, isExportDataset } from "./datasets";

describe("export dataset allow-list", () => {
  it.each([
    "../../etc/passwd",
    'members"; rm -rf /',
    "applications",
    "",
    "MEMBERS",
  ])("rejects %s", (value) => {
    // The dataset reaches the Content-Disposition filename, so anything not on
    // the list must be refused before it gets there.
    expect(isExportDataset(value)).toBe(false);
  });

  it.each(EXPORT_DATASETS)("accepts the known dataset %s", (dataset) => {
    expect(isExportDataset(dataset)).toBe(true);
  });

  it("labels every dataset, so no filename can come out undefined", () => {
    for (const dataset of EXPORT_DATASETS) {
      expect(DATASET_LABELS[dataset]).toBeTruthy();
    }
  });

  it("excludes applications, which stay behind their own capability", () => {
    // application:export is a separate capability. Widening this list must
    // never widen access to the most sensitive dataset in the system.
    expect(EXPORT_DATASETS).not.toContain("applications");
  });
});
