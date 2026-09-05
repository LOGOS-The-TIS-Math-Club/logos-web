import { describe, expect, it } from "vitest";

import {
  base64url,
  buildFilesUrl,
  buildFolderQuery,
  buildJwtClaims,
  escapeDriveLiteral,
  mapDriveFile,
  mapDriveFiles,
  normalisePrivateKey,
  TOKEN_ENDPOINT,
} from "./drive-protocol";

describe("escapeDriveLiteral", () => {
  it("escapes a quote that would otherwise close the literal", () => {
    /*
     * Drive's `q` is its own query language and the id is interpolated into a
     * single-quoted literal — the same shape of bug as SQL injection, in a
     * place people rarely look for it.
     */
    expect(escapeDriveLiteral("abc' or '1'='1")).toBe("abc\\' or \\'1\\'=\\'1");
  });

  it("escapes backslashes before quotes, so the escape cannot be escaped", () => {
    expect(escapeDriveLiteral("a\\'b")).toBe("a\\\\\\'b");
  });

  it("leaves an ordinary Drive id untouched", () => {
    expect(escapeDriveLiteral("1a2B3c-_xyz")).toBe("1a2B3c-_xyz");
  });
});

describe("buildFolderQuery", () => {
  it("scopes to direct children and excludes trashed files", () => {
    expect(buildFolderQuery("FOLDER")).toBe(
      "'FOLDER' in parents and trashed = false",
    );
  });
});

describe("buildFilesUrl", () => {
  it("requests only the fields the UI renders", () => {
    const url = new URL(buildFilesUrl("FOLDER"));

    expect(url.searchParams.get("fields")).toBe(
      "files(id,name,mimeType,webViewLink,modifiedTime,size)",
    );
  });

  it("supports shared drives, where club folders usually live", () => {
    const url = new URL(buildFilesUrl("FOLDER"));

    expect(url.searchParams.get("supportsAllDrives")).toBe("true");
    expect(url.searchParams.get("includeItemsFromAllDrives")).toBe("true");
  });

  it("encodes an injected quote rather than emitting it raw", () => {
    const url = buildFilesUrl("x' or trashed = true and '1'='1");

    expect(url).not.toContain("or+trashed+%3D+true+and+%271%27%3D%271'");
    expect(new URL(url).searchParams.get("q")).toContain("\\'");
  });
});

describe("mapDriveFile", () => {
  it("maps a complete file", () => {
    expect(
      mapDriveFile({
        id: "1",
        name: "Week 1.pdf",
        mimeType: "application/pdf",
        webViewLink: "https://drive.google.com/file/d/1/view",
        modifiedTime: "2026-09-04T00:00:00.000Z",
        size: "20480",
      }),
    ).toEqual({
      id: "1",
      name: "Week 1.pdf",
      mimeType: "application/pdf",
      webViewLink: "https://drive.google.com/file/d/1/view",
      modifiedTime: "2026-09-04T00:00:00.000Z",
      size: 20480,
    });
  });

  it("tolerates the missing size on a Google-native document", () => {
    // Docs and Sheets carry no size, so requiring one would drop them.
    const file = mapDriveFile({
      id: "1",
      name: "Notes",
      mimeType: "application/vnd.google-apps.document",
    });

    expect(file?.size).toBeNull();
    expect(file?.webViewLink).toBeNull();
  });

  it.each([null, undefined, 42, "a string", {}, { id: "1" }, { name: "x" }])(
    "returns null for malformed input %s",
    (input) => {
      expect(mapDriveFile(input)).toBeNull();
    },
  );
});

describe("mapDriveFiles", () => {
  it("drops malformed entries rather than failing the whole listing", () => {
    const files = mapDriveFiles({
      files: [{ id: "1", name: "Good.pdf" }, { name: "no id" }, null],
    });

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("Good.pdf");
  });

  it.each([{}, { files: "not an array" }, null])(
    "returns an empty list for %s",
    (payload) => {
      expect(mapDriveFiles(payload)).toEqual([]);
    },
  );
});

describe("buildJwtClaims", () => {
  const now = 1_760_000_000_000;

  it("targets the token endpoint and expires within Google's one-hour ceiling", () => {
    const claims = buildJwtClaims("svc@project.iam.gserviceaccount.com", now);

    expect(claims.aud).toBe(TOKEN_ENDPOINT);
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it("omits sub entirely when not impersonating", () => {
    // Google rejects the assertion if sub is present but empty, so it must be
    // absent rather than blank.
    expect(
      buildJwtClaims("svc@x.iam.gserviceaccount.com", now),
    ).not.toHaveProperty("sub");
    expect(
      buildJwtClaims("svc@x.iam.gserviceaccount.com", now, ""),
    ).not.toHaveProperty("sub");
    expect(
      buildJwtClaims("svc@x.iam.gserviceaccount.com", now, null),
    ).not.toHaveProperty("sub");
  });

  it("sets sub when impersonating the club mailbox", () => {
    expect(
      buildJwtClaims(
        "svc@x.iam.gserviceaccount.com",
        now,
        "mathclub@tokyois.com",
      ).sub,
    ).toBe("mathclub@tokyois.com");
  });
});

describe("base64url", () => {
  it("uses the URL alphabet and strips padding", () => {
    const encoded = base64url(Buffer.from([251, 255, 190]));

    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("normalisePrivateKey", () => {
  it("restores newlines written as \\n by a secret store", () => {
    // Most secret stores cannot hold a literal newline. Without this the key
    // parses as garbage and the failure reads like an auth problem.
    expect(
      normalisePrivateKey("-----BEGIN PRIVATE KEY-----\\nabc\\n-----END-----"),
    ).toBe("-----BEGIN PRIVATE KEY-----\nabc\n-----END-----");
  });

  it("leaves a key that already has real newlines alone", () => {
    const key = "-----BEGIN PRIVATE KEY-----\nabc\n-----END-----";

    expect(normalisePrivateKey(key)).toBe(key);
  });
});
