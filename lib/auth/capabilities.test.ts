import { describe, expect, it } from "vitest";
import { hasCapability } from "./capabilities";

describe("technical capabilities", () => {
  it("denies missing and unknown access", () => {
    expect(hasCapability(null, "identity:self:read")).toBe(false);
    expect(hasCapability("owner", "access:assign")).toBe(false);
    expect(hasCapability("access_admin", "future:unknown")).toBe(false);
  });

  it("maps levels explicitly without rank implication", () => {
    expect(hasCapability("basic", "identity:self:read")).toBe(true);
    expect(hasCapability("basic", "application:review")).toBe(false);
    expect(hasCapability("basic", "application:export")).toBe(false);
    expect(hasCapability("operator", "membership:read")).toBe(true);
    expect(hasCapability("operator", "membership:manage")).toBe(true);
    expect(hasCapability("operator", "session:manage")).toBe(true);
    expect(hasCapability("operator", "attendance:record")).toBe(true);
    expect(hasCapability("operator", "warning:manage")).toBe(true);
    expect(hasCapability("access_admin", "membership:manage")).toBe(false);
    expect(hasCapability("basic", "membership:read")).toBe(false);
    expect(hasCapability("access_admin", "identity:review")).toBe(false);
    expect(hasCapability("access_admin", "application:review")).toBe(false);
    expect(hasCapability("access_admin", "application:export")).toBe(false);
    expect(hasCapability("access_admin", "access:revoke")).toBe(true);
  });
});

