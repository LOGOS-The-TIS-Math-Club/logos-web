import { describe, expect, it } from "vitest";
import { generateApplicationsCsv, sanitizeCsvCell } from "./csv";
import {
  ApplicationStatusUpdateSchema,
  StudentApplicationInputSchema,
} from "./schema";

describe("StudentApplicationInputSchema", () => {
  const validPayload = {
    preferredName: "Alex Rivera",
    grade: "Grade 10",
    academicInterests: ["problem_solving", "geometry"],
    joinReason:
      "I love exploring difficult math puzzles and want to collaborate with peers.",
    goals:
      "I want to improve my geometry problem-solving and help prepare workshop sets.",
    experience: "Attended school math competition in grade 8.",
    mathCourse: null,
    contestInterest: "yes",
    presentInterest: "maybe",
    attendanceConfirmation: "regular",
    accuracyAcknowledged: true,
  };

  it("accepts valid application payload", () => {
    const result = StudentApplicationInputSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects empty preferred name", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      preferredName: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects preferred name exceeding 80 characters", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      preferredName: "A".repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid grade choice", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      grade: "Grade 8",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty mathematical interests", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      academicInterests: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid interest key", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      academicInterests: ["quantum_mechanics"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects join reason under 30 characters", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      joinReason: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects join reason exceeding 500 characters", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      joinReason: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects goals under 30 characters", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      goals: "I want to learn.",
    });
    expect(result.success).toBe(false);
  });

  it("transforms empty experience to null", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      experience: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.experience).toBeNull();
    }
  });

  it("rejects unacknowledged accuracy", () => {
    const result = StudentApplicationInputSchema.safeParse({
      ...validPayload,
      accuracyAcknowledged: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("ApplicationStatusUpdateSchema", () => {
  it("accepts valid status updates", () => {
    expect(
      ApplicationStatusUpdateSchema.safeParse({ status: "reviewing" }).success,
    ).toBe(true);
    expect(
      ApplicationStatusUpdateSchema.safeParse({
        status: "accepted",
        statusReason: "Strong problem solving interest",
      }).success,
    ).toBe(true);
    expect(
      ApplicationStatusUpdateSchema.safeParse({ status: "declined" }).success,
    ).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      ApplicationStatusUpdateSchema.safeParse({ status: "graduated" }).success,
    ).toBe(false);
  });
});

describe("CSV Formula Injection Defense (sanitizeCsvCell & generateApplicationsCsv)", () => {
  it("escapes cells starting with formula triggers (=, +, -, @, \\t, \\r)", () => {
    expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe('"\'=SUM(A1:A10)"');
    expect(sanitizeCsvCell("+12345")).toBe('"\' +12345"'.replace(" ", ""));
    expect(sanitizeCsvCell("-100")).toBe('"\' -100"'.replace(" ", ""));
    expect(sanitizeCsvCell("@SUM")).toBe('"\'@SUM"');
    expect(sanitizeCsvCell("\tTabValue")).toBe('"\'\tTabValue"');
    expect(sanitizeCsvCell("\rCarriageValue")).toBe('"\'\nCarriageValue"');
  });

  it("escapes double quotes properly", () => {
    expect(sanitizeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
  });

  it("generates structured CSV with headers and sanitized rows", () => {
    const applications = [
      {
        id: "d8c2e684-2195-460b-8ff9-0123456789ab",
        email: "student@tokyois.com",
        preferredName: "Jane Doe",
        grade: "Grade 11",
        academicInterests: ["problem_solving", "geometry"],
        joinReason: '=HYPERLINK("http://malicious.example.com", "Click")',
        goals: "Learn competitive math techniques and meet fellow enthusiasts.",
        experience: "+cmd|' /C calc'!A0",
        mathCourse: null,
        contestInterest: "yes",
        presentInterest: "maybe",
        attendanceConfirmation: "regular",
        status: "submitted",
        statusReason: null,
        submittedAt: new Date("2026-09-01T12:00:00Z"),
      },
    ];

    const csv = generateApplicationsCsv(applications);
    expect(csv).toContain("Application ID");
    expect(csv).toContain('"student@tokyois.com"');
    expect(csv).toContain("\"'=HYPERLINK");
    expect(csv).toContain("\"'+cmd|");
  });
});

describe("optional course level", () => {
  const base = {
    preferredName: "Sam",
    grade: "Grade 10" as const,
    academicInterests: ["algebra"],
    joinReason: "I want to get better at solving problems that take real time.",
    goals: "I would like to understand proofs properly rather than memorise.",
    experience: null,
    contestInterest: "maybe" as const,
    presentInterest: "no" as const,
    attendanceConfirmation: "regular" as const,
    accuracyAcknowledged: true as const,
  };

  it("accepts an application with no course level given", () => {
    const parsed = StudentApplicationInputSchema.parse({
      ...base,
      mathCourse: null,
    });
    expect(parsed.mathCourse).toBeNull();
  });

  it("accepts an application when the field is omitted entirely", () => {
    const parsed = StudentApplicationInputSchema.parse(base);
    expect(parsed.mathCourse).toBeNull();
  });

  it("stores 'prefer not to say' as no data rather than as a refusal", () => {
    // Declining should leave no record about the student, not a record that
    // they declined.
    const parsed = StudentApplicationInputSchema.parse({
      ...base,
      mathCourse: "prefer_not_to_say",
    });
    expect(parsed.mathCourse).toBeNull();
  });

  it("keeps a real course selection", () => {
    const parsed = StudentApplicationInputSchema.parse({
      ...base,
      mathCourse: "dp_aa_hl",
    });
    expect(parsed.mathCourse).toBe("dp_aa_hl");
  });

  it("still requires the two interest questions", () => {
    expect(() =>
      StudentApplicationInputSchema.parse({
        ...base,
        contestInterest: undefined,
      }),
    ).toThrow();
  });
});
