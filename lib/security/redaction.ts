/**
 * Strict Deny-by-Default Redaction & Sanitization Engine
 */
export interface RedactionBounds {
  readonly maxStringLength: number;
  readonly maxArrayLength: number;
  readonly maxKeys: number;
  readonly maxDepth: number;
  readonly maxSerializedBytes?: number;
}

export const DEFAULT_BOUNDS: RedactionBounds = Object.freeze({
  maxStringLength: 1024,
  maxArrayLength: 100,
  maxKeys: 50,
  maxDepth: 5,
  maxSerializedBytes: 4096,
});

export const REDACTION_PLACEHOLDERS = Object.freeze({
  redacted: "[REDACTED]",
  dbUrl: "[REDACTED_DB_URL]",
  jwt: "[REDACTED_JWT]",
  token: "[REDACTED_TOKEN]",
  secret: "[REDACTED_SECRET]",
  headers: "[REDACTED_HEADERS]",
  body: "[REDACTED_BODY]",
  query: "[REDACTED_QUERY]",
  email: "[REDACTED_EMAIL]",
  name: "[REDACTED_NAME]",
  absence: "[REDACTED_ABSENCE]",
  form: "[REDACTED_FORM]",
  truncated: "...[TRUNCATED]",
  circular: "[CIRCULAR]",
  maxDepth: "[MAX_DEPTH]",
  unreadable: "[UNREADABLE]",
  invalidDate: "[INVALID_DATE]",
});

export const normalizeKey = (k: string): string =>
  k.toLowerCase().replace(/[-_\s]/g, "");

const SENSITIVE_PATTERNS: readonly string[] = [
  "body",
  "header",
  "cookie",
  "auth",
  "token",
  "bearer",
  "jwt",
  "apikey",
  "password",
  "passphrase",
  "passwd",
  "secret",
  "query",
  "url",
  "email",
  "mail",
  "name",
  "absence",
  "form",
  "payload",
  "session",
  "credential",
];

export const isSensitiveKey = (key: string): boolean => {
  const norm = normalizeKey(key);
  return SENSITIVE_PATTERNS.some((p) => norm.includes(p));
};

export function deepFreeze<T>(val: T): T {
  if (val === null || typeof val !== "object" || Object.isFrozen(val))
    return val;
  if (Array.isArray(val)) {
    for (const item of val) deepFreeze(item);
    return Object.freeze(val) as T;
  }
  let keys: string[] = [];
  try {
    keys = Object.keys(val as Record<string, unknown>);
  } catch {
    return Object.freeze(val) as T;
  }
  for (const k of keys) {
    try {
      deepFreeze((val as Record<string, unknown>)[k]);
    } catch {
      /* ignore unreadable */
    }
  }
  return Object.freeze(val) as T;
}

function getByteLen(val: unknown): number {
  try {
    const json = JSON.stringify(val);
    if (!json) return 0;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(json, "utf8");
    return new TextEncoder().encode(json).length;
  } catch {
    return 0;
  }
}

export function sanitizeString(
  str: string,
  bounds?: Partial<RedactionBounds>,
): string {
  let res = str
    .replace(
      /\bpostgres(?:ql)?:\/\/[^\s"'`<>]+/gi,
      REDACTION_PLACEHOLDERS.dbUrl,
    )
    .replace(
      /\b(database[_\s-]?url|db[_\s-]?url|connection[_\s-]?string)\s*[:=]\s*["']?[^\s"',;]+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.dbUrl}`,
    )
    .replace(/\b([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^@\/\s"'`<>]+@/gi, "$1")
    .replace(
      /\b([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'`<>?#]+)\?[^#\s"'`<>]+/gi,
      "$1",
    )
    .replace(
      /\bBearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
      `Bearer ${REDACTION_PLACEHOLDERS.token}`,
    )
    .replace(
      /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}(?:\.[a-zA-Z0-9_-]+)?\b/g,
      REDACTION_PLACEHOLDERS.jwt,
    )
    .replace(
      /\b(api[_\s-]?key|access[_\s-]?token|refresh[_\s-]?token|oauth[_\s-]?token|auth[_\s-]?token|client[_\s-]?secret|secret[_\s-]?key|private[_\s-]?key|id[_\s-]?token)\s*[:=]\s*["']?[a-zA-Z0-9._~+/-]{6,}["']?/gi,
      `$1=${REDACTION_PLACEHOLDERS.token}`,
    )
    .replace(
      /\b(?:ghp|gho|ghu|ghs|ghr|sk|pk|sec)_[a-zA-Z0-9]{16,}\b/gi,
      REDACTION_PLACEHOLDERS.token,
    )
    .replace(
      /\b(authorization|proxy[_\s-]authorization|auth)\s*[:=]\s*["']?[^\r\n,;]+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.secret}`,
    )
    .replace(
      /\b(cookies?|set[_\s-]cookie)\s*[:=]\s*["']?[^\r\n,;]+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.secret}`,
    )
    .replace(
      /\b(session_?id|csrf_?token|auth_?token)=[^;\s"',]+/gi,
      `$1=${REDACTION_PLACEHOLDERS.secret}`,
    )
    .replace(
      /\b(request[_\s-]?headers|headers)\s*[:=]\s*["']?[^\r\n,;]+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.headers}`,
    )
    .replace(
      /\b(request[_\s-]?body|requestBody|request[_\s-]?payload|request|body|payload)\s*[:=]\s*["']?[^\r\n,;]+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.body}`,
    )
    .replace(
      /\b(query[_\s-]?string|queryString|query[_\s-]?params?|query)\s*[:=]\s*["']?[^\r\n,;]+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.query}`,
    )
    .replace(
      /\b(passwords?|passwd|secrets?|credentials?)\s*[:=]\s*["']?[^\r\n,;]+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.secret}`,
    )
    .replace(
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      REDACTION_PLACEHOLDERS.email,
    )
    .replace(
      /\b(student[_\s-]?name|teacher[_\s-]?name|user[_\s-]?name|full[_\s-]?name|first[_\s-]?name|last[_\s-]?name|name)\s*[:=]\s*["']?[^,\r\n"']+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.name}`,
    )
    .replace(
      /\b(absence[_\s-]?reason|absenceReason|absence[_\s-]?details|absence|reason[_\s-]for[_\s-]absence)\s*[:=]\s*["']?[^,\r\n"']+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.absence}`,
    )
    .replace(
      /\b(form[_\s-]?content|formContent|form[_\s-]?response|formResponse|form[_\s-]?data|formData|form[_\s-]?input)\s*[:=]\s*["']?[^,\r\n"']+["']?/gi,
      `$1: ${REDACTION_PLACEHOLDERS.form}`,
    );

  const maxLen = bounds?.maxStringLength ?? DEFAULT_BOUNDS.maxStringLength;
  if (res.length > maxLen) {
    const suf = REDACTION_PLACEHOLDERS.truncated;
    res =
      maxLen <= suf.length
        ? res.slice(0, maxLen)
        : res.slice(0, maxLen - suf.length) + suf;
  }
  return res;
}

function enforceBytes<T>(val: T, maxBytes: number): T {
  if (maxBytes <= 0 || getByteLen(val) <= maxBytes) return val;
  if (typeof val === "string") {
    let low = 0,
      high = val.length,
      best = "";
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cand = val.slice(0, mid) + REDACTION_PLACEHOLDERS.truncated;
      if (getByteLen(cand) <= maxBytes) {
        best = cand;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return (best || REDACTION_PLACEHOLDERS.truncated.slice(0, maxBytes)) as T;
  }
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    const reduced: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      reduced[k] = v;
      if (getByteLen(reduced) > maxBytes) {
        delete reduced[k];
        break;
      }
    }
    return Object.freeze(reduced) as T;
  }
  if (Array.isArray(val)) {
    const arr = [...(val as readonly unknown[])];
    while (arr.length > 0 && getByteLen(arr) > maxBytes) arr.pop();
    return Object.freeze(arr) as T;
  }
  return val;
}

function sanitizeChild(
  val: unknown,
  depth: number,
  allowed: Set<string>,
  hasWildcard: boolean,
  seen: Set<unknown>,
  b: RedactionBounds,
): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "number" || typeof val === "boolean") return val;
  if (typeof val === "bigint" || typeof val === "symbol") return val.toString();
  if (typeof val === "string") return sanitizeString(val, b);

  if (val instanceof Date) {
    return isNaN(val.getTime())
      ? REDACTION_PLACEHOLDERS.invalidDate
      : val.toISOString();
  }

  if (val instanceof URL) {
    if (val.protocol === "postgres:" || val.protocol === "postgresql:") {
      return REDACTION_PLACEHOLDERS.dbUrl;
    }
    try {
      const clean = new URL(val.toString());
      clean.username = "";
      clean.password = "";
      clean.search = "";
      return clean.toString();
    } catch {
      return REDACTION_PLACEHOLDERS.redacted;
    }
  }

  if (depth >= b.maxDepth) return REDACTION_PLACEHOLDERS.maxDepth;

  if (val instanceof Error) {
    const errObj: Record<string, unknown> = {
      name: sanitizeString(val.name || "Error", b),
      message: sanitizeString(val.message || "", b),
    };
    if ("code" in val && typeof (val as { code: unknown }).code === "string") {
      errObj.code = sanitizeString((val as { code: string }).code, b);
    }
    return Object.freeze(errObj);
  }

  if (typeof val === "object") {
    if (seen.has(val)) return REDACTION_PLACEHOLDERS.circular;
    seen.add(val);
    try {
      if (Array.isArray(val)) {
        return Object.freeze(
          val
            .slice(0, b.maxArrayLength)
            .map((item) =>
              sanitizeChild(item, depth + 1, allowed, hasWildcard, seen, b),
            ),
        );
      }
      return sanitizeLevel(
        val as Record<string, unknown>,
        depth + 1,
        allowed,
        hasWildcard,
        seen,
        b,
      );
    } finally {
      seen.delete(val);
    }
  }

  return REDACTION_PLACEHOLDERS.redacted;
}

function sanitizeLevel(
  obj: Record<string, unknown>,
  depth: number,
  allowed: Set<string>,
  hasWildcard: boolean,
  seen: Set<unknown>,
  b: RedactionBounds,
): Record<string, unknown> {
  let keys: string[] = [];
  try {
    keys = Object.keys(obj);
  } catch {
    return Object.freeze({});
  }

  const result: Record<string, unknown> = {};
  let count = 0;

  for (const key of keys) {
    if (count >= b.maxKeys) break;
    if (isSensitiveKey(key)) continue;
    if (!hasWildcard && !allowed.has(normalizeKey(key))) continue;

    let raw: unknown;
    try {
      raw = Reflect.get(obj, key);
    } catch {
      result[key] = REDACTION_PLACEHOLDERS.unreadable;
      count++;
      continue;
    }

    result[key] = sanitizeChild(raw, depth, allowed, hasWildcard, seen, b);
    count++;
  }

  return Object.freeze(result);
}

export function sanitizeAllowedObject<T = Record<string, unknown>>(
  input: unknown,
  allowedKeys: readonly string[] | ReadonlySet<string>,
  bounds?: Partial<RedactionBounds>,
): T {
  const b: RedactionBounds = { ...DEFAULT_BOUNDS, ...bounds };
  if (b.maxDepth <= 0) return Object.freeze({}) as T;

  const allowed = new Set(Array.from(allowedKeys).map(normalizeKey));
  const hasWildcard = allowed.has("*");

  if (input instanceof Error) {
    const errObj: Record<string, unknown> = {};
    if (hasWildcard || allowed.has("name")) {
      errObj.name = sanitizeString(input.name || "Error", b);
    }
    if (hasWildcard || allowed.has("message")) {
      errObj.message = sanitizeString(input.message || "", b);
    }
    if (
      (hasWildcard || allowed.has("code")) &&
      "code" in input &&
      typeof (input as { code: unknown }).code === "string"
    ) {
      errObj.code = sanitizeString((input as { code: string }).code, b);
    }
    return deepFreeze(errObj) as T;
  }

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({}) as T;
  }

  const seen = new Set<unknown>([input]);

  let sanitized: Record<string, unknown>;
  try {
    sanitized = sanitizeLevel(
      input as Record<string, unknown>,
      0,
      allowed,
      hasWildcard,
      seen,
      b,
    );
  } finally {
    seen.delete(input);
  }

  const bounded =
    b.maxSerializedBytes && b.maxSerializedBytes > 0
      ? enforceBytes(sanitized, b.maxSerializedBytes)
      : sanitized;

  return deepFreeze(bounded) as T;
}
