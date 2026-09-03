/**
 * Escape a single CSV cell value to prevent CSV / spreadsheet formula injection
 * and ensure standard RFC 4180 compliance.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let stringValue = String(value);

  // Prevent Spreadsheet Formula Injection (CSV injection / DDE attacks)
  // If the cell starts with =, +, -, @, tab, or carriage return / newline, prefix with a single quote
  if (/^[=+\-@\t\r\n]/.test(stringValue)) {
    stringValue = `'${stringValue}`;
  }

  // Normalize newlines within cells to LF
  stringValue = stringValue.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Escape existing double quotes by doubling them
  const escapedValue = stringValue.replace(/"/g, '""');

  return `"${escapedValue}"`;
}

export interface ApplicationCsvRow {
  id: string;
  email: string;
  preferredName: string;
  grade: string;
  academicInterests: string[];
  joinReason: string;
  goals: string;
  experience: string | null;
  mathCourse: string | null;
  contestInterest: string | null;
  presentInterest: string | null;
  attendanceConfirmation: string;
  status: string;
  statusReason: string | null;
  submittedAt: string | Date;
}

export function generateApplicationsCsv(
  applications: ApplicationCsvRow[],
): string {
  const headers = [
    "Application ID",
    "School Email",
    "Preferred Name",
    "Grade",
    "Mathematical Interests",
    "Why Join LOGOS",
    "Goals & Contributions",
    "Background & Experience",
    "Math Course",
    "Contest Interest",
    "Presenting Interest",
    "Meeting Attendance",
    "Status",
    "Status Reason",
    "Submitted At (UTC)",
  ];

  const headerRow = headers.map(sanitizeCsvCell).join(",");

  const dataRows = applications.map((app) => {
    const submittedDate =
      app.submittedAt instanceof Date
        ? app.submittedAt.toISOString()
        : new Date(app.submittedAt).toISOString();

    const interestsString = Array.isArray(app.academicInterests)
      ? app.academicInterests.join("; ")
      : String(app.academicInterests);

    const cells = [
      app.id,
      app.email,
      app.preferredName,
      app.grade,
      interestsString,
      app.joinReason,
      app.goals,
      app.experience ?? "",
      app.mathCourse ?? "",
      app.contestInterest ?? "",
      app.presentInterest ?? "",
      app.attendanceConfirmation,
      app.status,
      app.statusReason ?? "",
      submittedDate,
    ];

    return cells.map(sanitizeCsvCell).join(",");
  });

  return [headerRow, ...dataRows].join("\r\n");
}
