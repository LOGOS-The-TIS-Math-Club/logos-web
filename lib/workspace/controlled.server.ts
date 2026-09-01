import "server-only";

import type {
  GmailMessage,
  GmailTransport,
} from "@/lib/notifications/gmail.server";

import type { CalendarProvider } from "./calendar.server";
import type { AccessTokenProvider } from "./provider.server";

export class ControlledAccessTokenProvider implements AccessTokenProvider {
  async getAccessToken(): Promise<string> {
    return "synthetic-controlled-token";
  }
}

export class ControlledCalendarProvider implements CalendarProvider {
  constructor(private readonly response: unknown) {}
  async list(): Promise<unknown> {
    return structuredClone(this.response);
  }
}

export class ControlledGmailTransport implements GmailTransport {
  readonly messages: GmailMessage[] = [];
  constructor(private readonly providerId = "controlled-message-id") {}
  async send(message: GmailMessage): Promise<{ readonly id: string }> {
    this.messages.push(structuredClone(message));
    return { id: this.providerId };
  }
}
