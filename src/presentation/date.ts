const formatters = {
  "Asia/Tokyo": new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }),
  UTC: new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }),
};

// Display only. Machine-readable attributes, API dates, and native date-input
// values retain ISO format. Date-only Story records keep their UTC calendar day.
export function formatDisplayDate(
  date: Date,
  timeZone: keyof typeof formatters = "Asia/Tokyo",
): string {
  const { year, day, month } = Object.fromEntries(
    formatters[timeZone]
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${year}/${month}/${day}`;
}
