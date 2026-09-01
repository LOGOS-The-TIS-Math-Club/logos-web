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
    expect(hasCapability("operator", "identity:review")).toBe(true);
    expect(hasCapability("access_admin", "identity:review")).toBe(false);
    expect(hasCapability("access_admin", "access:revoke")).toBe(true);
  });
});
