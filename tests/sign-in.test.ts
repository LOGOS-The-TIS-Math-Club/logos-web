import assert from "node:assert/strict";
import test from "node:test";
import { internalDestination, returnDestination, accountDestinations, accountHeaderLinks } from "../src/auth/navigation.ts";
import { resolveAccount } from "../src/auth/account-state.ts";
import { completeSignIn } from "../src/auth/complete.ts";
import { isSignInConfigured } from "../src/auth/config.ts";
import { BackendError } from "../src/server/errors.ts";

const applicant = { id: "synthetic", email: "synthetic@tokyois.com", member: false, admin: false };
const member = { ...applicant, member: true };
const admin = { ...member, admin: true };

test("the header replaces Apply and Sign in with Account after sign-in", () => {
  assert.deepEqual(accountHeaderLinks("anonymous"), [
    { label: "Apply", href: "/apply" },
    { label: "Sign in", href: "/auth/sign-in" },
  ]);
  assert.deepEqual(accountHeaderLinks("signed-in"), [
    { label: "Account", href: "/auth/sign-in" },
  ]);
  assert.deepEqual(accountHeaderLinks("unconfigured"), accountHeaderLinks("anonymous"));
  for (const status of ["denied", "unavailable"] as const)
    assert.deepEqual(accountHeaderLinks(status), accountHeaderLinks("signed-in"));
});

test("return URLs reject external, encoded, normalized and Auth/API destinations", () => {
  for (const value of ["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/%2f%2fevil.invalid", "/%5cevil", "/about/../", "/about\n", "javascript:alert(1)", ["/about"]]) {
    assert.equal(internalDestination(value), null, String(value));
  }
  assert.equal(internalDestination("/about?from=account#charter"), "/about?from=account#charter");
  for (const actor of [applicant, member, admin]) {
    for (const path of ["/api/me", "/auth/complete", "/auth/sign-in", "/unknown", "/dashboard/other"]) {
      assert.equal(returnDestination(path, actor), null);
    }
    assert.equal(returnDestination("/about#charter", actor), "/about#charter");
    assert.equal(returnDestination("/apply", actor), "/apply");
    for (const path of ["/admin", "/admin/applications", "/admin/content/stories/new", "/admin/schedule"]) assert.equal(returnDestination(path, actor),actor.admin?path:null);
    assert.equal(returnDestination("/dashboard", actor), actor.member || actor.admin ? "/dashboard" : null);
    assert.equal(returnDestination("/dashboard/attendance", actor), actor.member || actor.admin ? "/dashboard/attendance" : null);
    const sessionPath="/dashboard/sessions/4d7f8620-201f-4c15-90dc-b5d7007b89c1?from=%2Fdashboard";
    assert.equal(returnDestination(sessionPath,actor),actor.member||actor.admin?sessionPath:null);
  }
});

test("account destinations use effective access and application existence", () => {
  assert.deepEqual(accountDestinations(applicant, false), ["Apply"]);
  assert.deepEqual(accountDestinations(applicant, true), ["View application"]);
  assert.deepEqual(accountDestinations(applicant, null), []);
  assert.deepEqual(accountDestinations(member, false), ["Open dashboard"]);
  assert.deepEqual(accountDestinations(admin, true), ["Open dashboard", "Leadership controls"]);
});

test("account states preserve server denials and distinguish failed status reads", async () => {
  const deps = { configured: true, currentUser: async () => applicant, applications: async () => [] as unknown[] };
  assert.deepEqual(await resolveAccount({ ...deps, configured: false, currentUser: async () => { throw Error("Must not call provider"); } }), { status: "unconfigured" });
  for (const [code, status, expected] of [["UNAUTHENTICATED", 401, "anonymous"], ["FORBIDDEN", 403, "denied"], ["IDENTITY_CONFLICT", 409, "denied"], ["UNAVAILABLE", 503, "unavailable"]] as const) {
    const result = await resolveAccount({ ...deps, currentUser: async () => { throw new BackendError(code, "private details", status); } });
    assert.equal(result.status, expected);
    assert.ok(!JSON.stringify(result).includes("private details"));
  }
  assert.deepEqual(await resolveAccount(deps), { status: "signed-in", user: applicant, hasApplication: false });
  assert.deepEqual(await resolveAccount({ ...deps, applications: async () => [{}] }), { status: "signed-in", user: applicant, hasApplication: true });
  assert.deepEqual(await resolveAccount({ ...deps, applications: async () => { throw Error(); } }), { status: "signed-in", user: applicant, hasApplication: null });
  assert.deepEqual(await resolveAccount({ ...deps, currentUser: async () => member, applications: async () => { throw Error("Must not load applications"); } }), { status: "signed-in", user: member, hasApplication: false });
});

test("completion verifies identity before any redirect and never loops into Auth", async () => {
  const request = (path?: string) => new Request(`http://localhost/auth/complete${path ? `?${new URLSearchParams({ returnTo: path })}` : ""}`);
  let verified = 0;
  const lookup = async () => { verified++; return applicant; };
  assert.equal((await completeSignIn(request("/about"), lookup)).headers.get("Location"), "/about");
  assert.equal(verified, 1);
  for (const path of [undefined, "https://evil.invalid", "/admin", "/auth/complete"]) {
    const response = await completeSignIn(request(path), lookup);
    assert.equal(response.status, 303);
    assert.match(response.headers.get("Location")!, /^\/auth\/sign-in\?/);
    assert.match(response.headers.get("Cache-Control")!, /no-store, private/);
  }
  for (const status of [401, 403, 409, 503]) {
    const response = await completeSignIn(request("/about"), async () => { throw new BackendError(status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", "secret", status); });
    assert.match(response.headers.get("Location")!, /^\/auth\/sign-in\?/);
    assert.ok(!(await response.text()).includes("secret"));
  }
});

test("partial or malformed Auth configuration remains unavailable", () => {
  assert.equal(isSignInConfigured({}), false);
  assert.equal(isSignInConfigured({ NEON_AUTH_BASE_URL: "not a URL" }), false);
  const env = { DATABASE_URL: "postgresql://localhost/synthetic", APP_URL: "http://localhost:3002", NEON_AUTH_BASE_URL: "https://synthetic.invalid/auth", NEON_AUTH_COOKIE_SECRET: "x".repeat(32), GOOGLE_OAUTH_CLIENT_ID: "synthetic" };
  assert.equal(isSignInConfigured(env), true);
  assert.equal(isSignInConfigured({ ...env, GOOGLE_OAUTH_CLIENT_ID: "" }), false);
});
