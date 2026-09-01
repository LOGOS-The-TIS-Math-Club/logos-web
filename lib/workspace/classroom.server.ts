import "server-only";

import { z } from "zod";

const ClassroomLink = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "classroom.google.com" ||
        url.hostname.endsWith(".classroom.google.com"))
    );
  });
export type ClassroomLinkResult =
  | { status: "configured"; url: string }
  | { status: "unavailable" }
  | { status: "invalid" };

export function getClassroomLink(
  config: Readonly<Record<string, unknown>>,
  key: string,
): ClassroomLinkResult {
  if (!(key in config)) return { status: "unavailable" };
  const parsed = ClassroomLink.safeParse(config[key]);
  return parsed.success
    ? { status: "configured", url: parsed.data }
    : { status: "invalid" };
}
