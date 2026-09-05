import { sanitizeCsvCell } from "@/lib/applications/csv";

/*
 * Builds a CSV from headers and rows.
 *
 * Cell escaping is delegated to sanitizeCsvCell, the escaper the applications
 * export already uses. It is the one place that knows to neutralise leading
 * =, +, - and @, which spreadsheets interpret as formulas — an exported roster
 * is opened in Excel or Sheets by definition, so that is not a theoretical
 * concern.
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [headers.map(sanitizeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(sanitizeCsvCell).join(","));
  }
  // Trailing newline: POSIX tools treat a file without one as truncated.
  return lines.join("\r\n") + "\r\n";
}

/** ISO instant, or empty for null. Stable and sortable in a spreadsheet. */
export function csvDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : value;
}
