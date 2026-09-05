/**
 * Names one file in a backup run: `logos-2026-09-04-members.csv`.
 *
 * Dated so runs sort chronologically in Drive and never collide, and in UTC
 * rather than local time — a late-evening run in Tokyo would otherwise be
 * labelled with the following day and leave an apparent gap in the sequence.
 *
 * Kept out of backup.server.ts so it can be tested without the Drive client
 * and the database behind "server-only".
 */
export function backupFileName(dataset: string, now: Date): string {
  return `logos-${now.toISOString().slice(0, 10)}-${dataset}.csv`;
}
