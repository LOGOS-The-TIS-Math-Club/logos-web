import "server-only";

import { uploadBackupFile } from "@/lib/google/drive.server";
import { backupFileName } from "./backup-naming";
import { EXPORT_DATASETS } from "./datasets";
import { exportDatasetCsvForScheduledBackup } from "./service.server";

/*
 * Writes the club's records to its own Drive.
 *
 * The point is survivability: leadership changes every year, and the hosting
 * account is not owned by the school. A copy in the club's Drive means the
 * records outlive both.
 */

export interface BackupResult {
  dataset: string;
  fileName: string;
  fileId?: string;
  error?: string;
}

/**
 * Exports every dataset and uploads each one.
 *
 * Datasets are attempted independently and failures are collected rather than
 * thrown. A backup that aborts halfway because one table had a problem is
 * worse than a partial backup that says which part is missing.
 */
export async function runDriveBackup(
  now: Date = new Date(),
): Promise<BackupResult[]> {
  const results: BackupResult[] = [];

  for (const dataset of EXPORT_DATASETS) {
    const fileName = backupFileName(dataset, now);

    try {
      const csv = await exportDatasetCsvForScheduledBackup(dataset);
      const { id } = await uploadBackupFile(fileName, "text/csv", csv);
      results.push({ dataset, fileName, fileId: id });
    } catch (error) {
      results.push({
        dataset,
        fileName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
