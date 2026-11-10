import { Disclosure } from "./disclosure.tsx";
import {
  interests,
  courses,
  contestOptions,
  presentOptions,
  attendanceOptions,
  optionLabel,
  statusLabels,
} from "../src/applications/presentation.ts";
import type { OwnApplication } from "../src/applications/presentation.ts";
import { formatDisplayDate } from "../src/presentation/date.ts";

export function ApplicationAnswers({
  application,
  earlier = false,
}: {
  application: OwnApplication;
  earlier?: boolean;
}) {
  const a = application;
  return (
    <Disclosure
      className="application-answers"
      summary={
        earlier
          ? `${statusLabels[a.status]} - ${formatDisplayDate(new Date(a.submitted_at))}`
          : "View submitted answers"
      }
    >
      <dl>
        {[
          ["Preferred name", a.preferred_name],
          [
            "Grade level",
            `Grade ${a.grade} (${a.grade_academic_year}-${a.grade_academic_year + 1})`,
          ],
          [
            "Mathematical interests",
            a.academic_interests
              .map((value) => optionLabel(interests, value))
              .join(", "),
          ],
          ["Why would you like to join LOGOS?", a.join_reason],
          ["What would you like to learn or contribute?", a.goals],
          ["Relevant background or experience", a.experience ?? "Not provided"],
          ["Maths course", optionLabel(courses, a.math_course)],
          [
            "In-club contest interest",
            optionLabel(contestOptions, a.contest_interest),
          ],
          [
            "Presenting a topic",
            optionLabel(presentOptions, a.present_interest),
          ],
          [
            "Regular meeting availability",
            optionLabel(attendanceOptions, a.attendance_confirmation),
          ],
          [
            "Accuracy statement",
            a.accuracy_acknowledged ? "Acknowledged" : "Not recorded",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}
