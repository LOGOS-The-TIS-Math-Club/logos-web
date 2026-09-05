/*
 * The exportable datasets.
 *
 * Kept out of service.server.ts so the allow-list can be imported by a page or
 * a test without dragging in the database and auth stack behind "server-only".
 */

export const EXPORT_DATASETS = [
  "members",
  "sessions",
  "attendance",
  "absences",
  "warnings",
  "announcements",
  "resources",
] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

/**
 * Applications are deliberately absent. They are the most sensitive dataset
 * here and keep their own route behind application:export, so widening this
 * list can never widen access to them.
 */
export function isExportDataset(value: string): value is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(value);
}

/** Human label used in the download filename. */
export const DATASET_LABELS: Record<ExportDataset, string> = {
  members: "members",
  sessions: "sessions",
  attendance: "attendance",
  absences: "absences",
  warnings: "warnings",
  announcements: "announcements",
  resources: "resources",
};
