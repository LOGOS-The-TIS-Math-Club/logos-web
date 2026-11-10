import { formatDisplayDate } from "../presentation/date.ts";
import type { AttendanceData, SessionSummary } from "./types.ts";
export const attendanceLabels = {
  present: "Present",
  late: "Late",
  excused_absence: "Excused absence",
  unexcused_absence: "Unexcused absence",
  unmarked: "Not marked yet",
};
export const noticeLabels = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  cancelled: "Withdrawn",
};
const tokyoClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function tokyoDay(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function displayDay(value: string) {
  return formatDisplayDate(new Date(value + "T00:00:00Z"), "UTC");
}
export function sessionTime(session: SessionSummary) {
  const endDate =
    tokyoDay(session.endsAt) !== tokyoDay(session.startsAt)
      ? `${formatDisplayDate(new Date(session.endsAt))} `
      : "";
  return `${tokyoClock.format(new Date(session.startsAt))}-${endDate}${tokyoClock.format(new Date(session.endsAt))} JST`;
}
export function attendanceText(summary: AttendanceData["summary"]) {
  if (summary.eligibleSessions === 0) return "No eligible sessions yet";
  if (summary.percentage === null)
    return "No settled attendance percentage yet";
  return `${summary.percentage}% attendance`;
}
export function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    return day > 0 && day <= count
      ? `${month}-${String(day).padStart(2, "0")}`
      : null;
  });
}
export function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1))
    .toISOString()
    .slice(0, 7);
}
