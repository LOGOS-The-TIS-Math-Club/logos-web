export function isSignInConfigured(env: Record<string, string | undefined> = process.env) {
  try {
    return Boolean(env.DATABASE_URL && env.GOOGLE_OAUTH_CLIENT_ID &&
      env.NEON_AUTH_COOKIE_SECRET && env.NEON_AUTH_COOKIE_SECRET.length >= 32 &&
      env.NEON_AUTH_BASE_URL && new URL(env.NEON_AUTH_BASE_URL).protocol === "https:" &&
      env.APP_URL && ["http:", "https:"].includes(new URL(env.APP_URL).protocol));
  } catch { return false; }
}
