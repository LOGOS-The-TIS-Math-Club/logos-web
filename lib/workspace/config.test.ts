import { describe, expect, test } from "vitest";

import {
  parseGmailCredentialConfiguration,
  parseServiceAccountCredentialConfiguration,
  parseWorkspaceConfiguration,
  WORKSPACE_SCOPES,
} from "./config.server";
import { getClassroomLink } from "./classroom.server";
import { failureForStatus, ProviderFailure } from "./provider.server";

describe("Workspace configuration and bounded failures", () => {
  test("validates allowlisted resource configuration and exact scopes", () => {
    expect(
      parseWorkspaceConfiguration({
        GOOGLE_CALENDAR_ID: "test-calendar@group.calendar.google.com",
        GOOGLE_DRIVE_RESOURCES: '{"handbook":"file_123"}',
        GOOGLE_CLASSROOM_LINKS:
          '{"weekly":"https://classroom.google.com/c/test"}',
      }),
    ).toMatchObject({ calendarId: "test-calendar@group.calendar.google.com" });
    expect(WORKSPACE_SCOPES).toEqual({
      calendar: "https://www.googleapis.com/auth/calendar.events.readonly",
      drive: "https://www.googleapis.com/auth/drive.metadata.readonly",
      gmail: "https://www.googleapis.com/auth/gmail.send",
    });
  });

  test("rejects malformed provider configuration without echoing it", () => {
    expect(() =>
      parseWorkspaceConfiguration({
        GOOGLE_CALENDAR_ID: "bad/id",
        GOOGLE_DRIVE_RESOURCES: "not-json-secret",
      }),
    ).toThrow("Workspace configuration is invalid");
  });

  test("prohibits Gmail credentials outside production", () => {
    expect(() =>
      parseGmailCredentialConfiguration({
        APP_ENV: "preview",
        GMAIL_SENDER: "mathclub@tokyois.com",
        GMAIL_CLIENT_ID: "id",
        GMAIL_CLIENT_SECRET: "secret",
        GMAIL_REFRESH_TOKEN: "token",
      }),
    ).toThrow("not configured for this environment");
  });

  test("validates service-account credentials without exposing values", () => {
    expect(() =>
      parseServiceAccountCredentialConfiguration({
        APP_ENV: "preview",
        GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL: "not-an-email",
        GOOGLE_WORKSPACE_PRIVATE_KEY: "private-value",
      }),
    ).toThrow("Workspace service account is not configured");
  });

  test("accepts an independently revocable test service account only in development", () => {
    expect(
      parseServiceAccountCredentialConfiguration({
        APP_ENV: "development",
        GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL: "workspace-test@example.test",
        GOOGLE_WORKSPACE_PRIVATE_KEY:
          "-----BEGIN " +
          "PRIVATE KEY-----\ncontrolled\n-----END PRIVATE KEY-----",
      }),
    ).toMatchObject({ appEnvironment: "development" });
  });

  test("returns configured, invalid, and unavailable Classroom states", () => {
    expect(
      getClassroomLink(
        { weekly: "https://classroom.google.com/c/test" },
        "weekly",
      ),
    ).toEqual({
      status: "configured",
      url: "https://classroom.google.com/c/test",
    });
    expect(getClassroomLink({ weekly: "https://evil.test" }, "weekly")).toEqual(
      { status: "invalid" },
    );
    expect(getClassroomLink({}, "weekly")).toEqual({ status: "unavailable" });
  });

  test("classifies auth, permission, transient, and permanent responses", () => {
    expect(failureForStatus(401)).toMatchObject({ retryable: false });
    expect(failureForStatus(403)).toMatchObject({
      code: "permission_denied",
    });
    expect(failureForStatus(429)).toMatchObject({ retryable: true });
    expect(failureForStatus(400)).toBeInstanceOf(ProviderFailure);
  });
});
