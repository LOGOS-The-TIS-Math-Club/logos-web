"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ATTENDANCE_OPTIONS,
  GRADES,
  MATHEMATICAL_INTERESTS,
} from "@/lib/applications/schema";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

interface ApplicationFormProps {
  verifiedEmail: string;
}

interface FormErrors {
  preferredName?: string;
  grade?: string;
  academicInterests?: string;
  joinReason?: string;
  goals?: string;
  experience?: string;
  attendanceConfirmation?: string;
  accuracyAcknowledged?: string;
  generic?: string;
}

export function ApplicationForm({ verifiedEmail }: ApplicationFormProps) {
  const router = useRouter();
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const [preferredName, setPreferredName] = useState("");
  const [grade, setGrade] = useState("");
  const [academicInterests, setAcademicInterests] = useState<string[]>([]);
  const [joinReason, setJoinReason] = useState("");
  const [goals, setGoals] = useState("");
  const [experience, setExperience] = useState("");
  const [attendanceConfirmation, setAttendanceConfirmation] = useState("");
  const [accuracyAcknowledged, setAccuracyAcknowledged] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const preferredNameId = useId();
  const joinReasonId = useId();
  const goalsId = useId();
  const experienceId = useId();
  const accuracyId = useId();

  const handleInterestToggle = (key: string) => {
    setAcademicInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
    if (errors.academicInterests) {
      setErrors((prev) => ({ ...prev, academicInterests: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!preferredName.trim()) {
      newErrors.preferredName = "Please enter your preferred name";
    } else if (preferredName.trim().length > 80) {
      newErrors.preferredName = "Preferred name must not exceed 80 characters";
    }

    if (!grade) {
      newErrors.grade = "Please select your grade level (Grades 9–12)";
    }

    if (academicInterests.length === 0) {
      newErrors.academicInterests =
        "Please select at least one mathematical interest";
    }

    if (joinReason.trim().length < 30) {
      newErrors.joinReason = `Please provide at least 30 characters (${joinReason.trim().length}/30)`;
    } else if (joinReason.trim().length > 500) {
      newErrors.joinReason = `Maximum length is 500 characters (${joinReason.trim().length}/500)`;
    }

    if (goals.trim().length < 30) {
      newErrors.goals = `Please provide at least 30 characters (${goals.trim().length}/30)`;
    } else if (goals.trim().length > 500) {
      newErrors.goals = `Maximum length is 500 characters (${goals.trim().length}/500)`;
    }

    if (experience.trim().length > 500) {
      newErrors.experience =
        "Background experience must not exceed 500 characters";
    }

    if (!attendanceConfirmation) {
      newErrors.attendanceConfirmation =
        "Please select your regular meeting availability";
    }

    if (!accuracyAcknowledged) {
      newErrors.accuracyAcknowledged =
        "You must confirm the accuracy statement and agree to club communications";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      errorSummaryRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const csrfToken = decodeURIComponent(getCookie("__Host-logos_csrf"));
      const sessionCsrfToken = decodeURIComponent(
        getCookie("__Host-logos_session_csrf"),
      );

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      if (sessionCsrfToken) headers["X-Session-CSRF-Token"] = sessionCsrfToken;

      const response = await fetch("/api/applications", {
        method: "POST",
        headers,
        body: JSON.stringify({
          preferredName: preferredName.trim(),
          grade,
          academicInterests,
          joinReason: joinReason.trim(),
          goals: goals.trim(),
          experience: experience.trim() || null,
          attendanceConfirmation,
          accuracyAcknowledged,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setErrors({
            generic:
              "An active application has already been submitted for your account.",
          });
        } else if (response.status === 403) {
          setErrors({
            generic:
              "Applications require an active verified @tokyois.com school account.",
          });
        } else if (result.errors && Array.isArray(result.errors)) {
          const fieldMap: FormErrors = {};
          for (const err of result.errors) {
            fieldMap[err.field as keyof FormErrors] = err.message;
          }
          setErrors(fieldMap);
        } else {
          setErrors({
            generic: result.message || "Submission failed. Please try again.",
          });
        }
        errorSummaryRef.current?.focus();
        setSubmitting(false);
        return;
      }

      router.push("/apply/confirmation");
    } catch {
      setErrors({
        generic:
          "A network error occurred. Please check your connection and retry.",
      });
      errorSummaryRef.current?.focus();
      setSubmitting(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      {/* Verified Identity Read-Only Callout */}
      <div className="border-border bg-surface rounded-component border p-4 sm:p-5">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Verified Applicant Identity
        </p>
        <p className="text-foreground mt-1 text-sm font-semibold">
          {verifiedEmail}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Authenticated via Tokyo International School Google Workspace.
        </p>
      </div>

      {/* Error Summary Banner */}
      {hasErrors && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="error-summary-heading"
          className="border-danger bg-danger-surface rounded-component border p-4 text-sm focus:outline-none"
        >
          <h2 id="error-summary-heading" className="text-danger font-semibold">
            Please correct the errors below to submit:
          </h2>
          <ul className="text-danger mt-2 list-inside list-disc space-y-1 text-xs">
            {Object.entries(errors).map(([field, msg]) => (
              <li key={field}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Preferred Name */}
      <div className="space-y-1.5">
        <label
          htmlFor={preferredNameId}
          className="text-foreground block text-sm font-semibold"
        >
          1. Preferred Name{" "}
          <span aria-hidden="true" className="text-primary">
            *
          </span>
        </label>
        <p
          id={`${preferredNameId}-desc`}
          className="text-muted-foreground text-xs"
        >
          What name should club leaders and peers use for you? (Max 80
          characters)
        </p>
        <input
          id={preferredNameId}
          type="text"
          value={preferredName}
          maxLength={80}
          required
          aria-required="true"
          aria-describedby={`${preferredNameId}-desc ${errors.preferredName ? `${preferredNameId}-err` : ""}`}
          aria-invalid={Boolean(errors.preferredName)}
          onChange={(e) => {
            setPreferredName(e.target.value);
            if (errors.preferredName) {
              setErrors((prev) => ({ ...prev, preferredName: undefined }));
            }
          }}
          className="border-border bg-surface text-foreground focus-visible:border-primary focus-visible:outline-focus rounded-component w-full border px-3.5 py-2.5 text-sm transition-colors"
          placeholder="e.g. Alex Rivera"
        />
        {errors.preferredName && (
          <p
            id={`${preferredNameId}-err`}
            role="alert"
            className="text-danger text-xs"
          >
            {errors.preferredName}
          </p>
        )}
      </div>

      {/* 2. Grade / Year Level */}
      <fieldset className="space-y-3">
        <legend className="text-foreground text-sm font-semibold">
          2. Grade Level{" "}
          <span aria-hidden="true" className="text-primary">
            *
          </span>
        </legend>
        <p id="grade-desc" className="text-muted-foreground text-xs">
          Select your current high school grade level for 2026–2027.
        </p>
        <div
          role="radiogroup"
          aria-describedby={`grade-desc ${errors.grade ? "grade-err" : ""}`}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {GRADES.map((g) => {
            const isSelected = grade === g;
            return (
              <label
                key={g}
                className={`border-border rounded-component flex cursor-pointer items-center justify-center border p-3 text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-transparent font-semibold"
                    : "bg-surface text-foreground hover:bg-surface-raised"
                }`}
              >
                <input
                  type="radio"
                  name="grade"
                  value={g}
                  checked={isSelected}
                  onChange={() => {
                    setGrade(g);
                    if (errors.grade) {
                      setErrors((prev) => ({ ...prev, grade: undefined }));
                    }
                  }}
                  className="sr-only"
                />
                <span>{g}</span>
              </label>
            );
          })}
        </div>
        {errors.grade && (
          <p id="grade-err" role="alert" className="text-danger text-xs">
            {errors.grade}
          </p>
        )}
      </fieldset>

      {/* 3. Mathematical Interests */}
      <fieldset className="space-y-3">
        <legend className="text-foreground text-sm font-semibold">
          3. Mathematical Interests{" "}
          <span aria-hidden="true" className="text-primary">
            *
          </span>
        </legend>
        <p id="interests-desc" className="text-muted-foreground text-xs">
          Which areas of mathematics or problem solving excite you most? (Select
          1 or more)
        </p>
        <div
          aria-describedby={`interests-desc ${errors.academicInterests ? "interests-err" : ""}`}
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        >
          {MATHEMATICAL_INTERESTS.map(({ key, label }) => {
            const checked = academicInterests.includes(key);
            return (
              <label
                key={key}
                className={`border-border rounded-component flex cursor-pointer items-start gap-3 border p-3 text-sm transition-colors ${
                  checked
                    ? "border-primary bg-surface-raised text-foreground"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  value={key}
                  checked={checked}
                  onChange={() => handleInterestToggle(key)}
                  className="mt-0.5 h-4 w-4 rounded accent-[var(--color-primary)]"
                />
                <span className="leading-snug">{label}</span>
              </label>
            );
          })}
        </div>
        {errors.academicInterests && (
          <p id="interests-err" role="alert" className="text-danger text-xs">
            {errors.academicInterests}
          </p>
        )}
      </fieldset>

      {/* 4. Why Join LOGOS */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={joinReasonId}
            className="text-foreground block text-sm font-semibold"
          >
            4. Why would you like to join LOGOS?{" "}
            <span aria-hidden="true" className="text-primary">
              *
            </span>
          </label>
          <span
            aria-live="polite"
            className={`text-xs ${
              joinReason.length < 30 || joinReason.length > 500
                ? "text-muted-foreground"
                : "text-primary"
            }`}
          >
            {joinReason.length} / 500 chars (min 30)
          </span>
        </div>
        <p
          id={`${joinReasonId}-desc`}
          className="text-muted-foreground text-xs"
        >
          Tell us about your interest in mathematics and what motivates you to
          apply.
        </p>
        <textarea
          id={joinReasonId}
          rows={4}
          value={joinReason}
          maxLength={500}
          required
          aria-required="true"
          aria-describedby={`${joinReasonId}-desc ${errors.joinReason ? `${joinReasonId}-err` : ""}`}
          aria-invalid={Boolean(errors.joinReason)}
          onChange={(e) => {
            setJoinReason(e.target.value);
            if (errors.joinReason) {
              setErrors((prev) => ({ ...prev, joinReason: undefined }));
            }
          }}
          className="border-border bg-surface text-foreground focus-visible:border-primary focus-visible:outline-focus rounded-component w-full border px-3.5 py-2.5 text-sm transition-colors"
          placeholder="Share your thoughts on exploring problems, working with others, or what drew you to LOGOS..."
        />
        {errors.joinReason && (
          <p
            id={`${joinReasonId}-err`}
            role="alert"
            className="text-danger text-xs"
          >
            {errors.joinReason}
          </p>
        )}
      </div>

      {/* 5. What would you like to learn or contribute? */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={goalsId}
            className="text-foreground block text-sm font-semibold"
          >
            5. What would you like to learn or contribute?{" "}
            <span aria-hidden="true" className="text-primary">
              *
            </span>
          </label>
          <span
            aria-live="polite"
            className={`text-xs ${
              goals.length < 30 || goals.length > 500
                ? "text-muted-foreground"
                : "text-primary"
            }`}
          >
            {goals.length} / 500 chars (min 30)
          </span>
        </div>
        <p id={`${goalsId}-desc`} className="text-muted-foreground text-xs">
          What topics, challenges, or collaborative activities do you hope to
          explore or share?
        </p>
        <textarea
          id={goalsId}
          rows={4}
          value={goals}
          maxLength={500}
          required
          aria-required="true"
          aria-describedby={`${goalsId}-desc ${errors.goals ? `${goalsId}-err` : ""}`}
          aria-invalid={Boolean(errors.goals)}
          onChange={(e) => {
            setGoals(e.target.value);
            if (errors.goals) {
              setErrors((prev) => ({ ...prev, goals: undefined }));
            }
          }}
          className="border-border bg-surface text-foreground focus-visible:border-primary focus-visible:outline-focus rounded-component w-full border px-3.5 py-2.5 text-sm transition-colors"
          placeholder="Topics you're curious about, ideas for workshops, or skills you'd like to develop..."
        />
        {errors.goals && (
          <p id={`${goalsId}-err`} role="alert" className="text-danger text-xs">
            {errors.goals}
          </p>
        )}
      </div>

      {/* 6. Relevant background (optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={experienceId}
            className="text-foreground block text-sm font-semibold"
          >
            6. Relevant Background or Experience (Optional)
          </label>
          <span className="text-muted-foreground text-xs">
            {experience.length} / 500 chars
          </span>
        </div>
        <p
          id={`${experienceId}-desc`}
          className="text-muted-foreground text-xs"
        >
          Prior competition experience is not required. If you have participated
          in any math contests, clubs, or personal projects, feel free to
          mention them briefly.
        </p>
        <textarea
          id={experienceId}
          rows={3}
          value={experience}
          maxLength={500}
          aria-describedby={`${experienceId}-desc ${errors.experience ? `${experienceId}-err` : ""}`}
          aria-invalid={Boolean(errors.experience)}
          onChange={(e) => {
            setExperience(e.target.value);
            if (errors.experience) {
              setErrors((prev) => ({ ...prev, experience: undefined }));
            }
          }}
          className="border-border bg-surface text-foreground focus-visible:border-primary focus-visible:outline-focus rounded-component w-full border px-3.5 py-2.5 text-sm transition-colors"
          placeholder="Optional: AMC 8/10, math circles, independent study, or puzzle hobbies..."
        />
        {errors.experience && (
          <p
            id={`${experienceId}-err`}
            role="alert"
            className="text-danger text-xs"
          >
            {errors.experience}
          </p>
        )}
      </div>

      {/* 7. Meeting Attendance */}
      <fieldset className="space-y-3">
        <legend className="text-foreground text-sm font-semibold">
          7. Regular Meeting Availability{" "}
          <span aria-hidden="true" className="text-primary">
            *
          </span>
        </legend>
        <p id="attendance-desc" className="text-muted-foreground text-xs">
          Can you normally attend our regular weekly meetings:{" "}
          <strong>Every Friday after school, 15:30–16:30 in Room 101</strong>?
        </p>
        <div
          role="radiogroup"
          aria-describedby={`attendance-desc ${errors.attendanceConfirmation ? "attendance-err" : ""}`}
          className="space-y-2"
        >
          {ATTENDANCE_OPTIONS.map(({ key, label }) => {
            const isSelected = attendanceConfirmation === key;
            return (
              <label
                key={key}
                className={`border-border rounded-component flex cursor-pointer items-center gap-3 border p-3.5 text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-surface-raised text-foreground font-medium"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="attendance"
                  value={key}
                  checked={isSelected}
                  onChange={() => {
                    setAttendanceConfirmation(key);
                    if (errors.attendanceConfirmation) {
                      setErrors((prev) => ({
                        ...prev,
                        attendanceConfirmation: undefined,
                      }));
                    }
                  }}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
        {errors.attendanceConfirmation && (
          <p id="attendance-err" role="alert" className="text-danger text-xs">
            {errors.attendanceConfirmation}
          </p>
        )}
      </fieldset>

      {/* 8. Final Acknowledgement */}
      <div className="border-border bg-surface rounded-component border p-4 sm:p-5">
        <label
          htmlFor={accuracyId}
          className="flex cursor-pointer items-start gap-3 text-sm"
        >
          <input
            id={accuracyId}
            type="checkbox"
            checked={accuracyAcknowledged}
            required
            aria-required="true"
            aria-describedby={
              errors.accuracyAcknowledged ? `${accuracyId}-err` : undefined
            }
            aria-invalid={Boolean(errors.accuracyAcknowledged)}
            onChange={(e) => {
              setAccuracyAcknowledged(e.target.checked);
              if (errors.accuracyAcknowledged) {
                setErrors((prev) => ({
                  ...prev,
                  accuracyAcknowledged: undefined,
                }));
              }
            }}
            className="mt-0.5 h-4 w-4 rounded accent-[var(--color-primary)]"
          />
          <span className="text-foreground leading-relaxed">
            I confirm that the information provided is accurate and understand
            that LOGOS may use my verified TIS email for club-related
            communication.
          </span>
        </label>
        {errors.accuracyAcknowledged && (
          <p
            id={`${accuracyId}-err`}
            role="alert"
            className="text-danger mt-2 text-xs"
          >
            {errors.accuracyAcknowledged}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus flex min-h-11 w-full cursor-pointer items-center justify-center px-6 py-3 text-base font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:w-auto"
        >
          {submitting ? "Submitting Application…" : "Submit Application"}
        </button>
      </div>
    </form>
  );
}
