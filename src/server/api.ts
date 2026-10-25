import type postgres from "postgres";
import { z } from "zod";
import type { CurrentUser } from "../auth/current-user.ts";
import { BackendError } from "./errors.ts";
import {
  handleErrors,
  json,
  readJson,
  requireSameOrigin,
  privateHeaders,
} from "./http.ts";
import { submitApplication } from "../applications/operations.ts";
import { getOwnApplications } from "../access/operations.ts";
import * as applications from "../applications/review.ts";
import * as members from "../membership/operations.ts";
import * as sessions from "../sessions/calendar.ts";
import * as attendance from "../attendance/operations.ts";
import * as content from "../content/operations.ts";

const revision = z.number().int().positive();
const uuid = z.uuid();
const object = z.record(z.string(), z.unknown());
export type ApiDependencies = {
  sql: postgres.Sql;
  currentUser: () => Promise<CurrentUser>;
  appUrl: string;
};

// Framework-independent Request/Response boundary; Next only supplies the runtime dependencies.
export function createApi({ sql, currentUser, appUrl }: ApiDependencies) {
  return (request: Request) =>
    handleErrors(async () => {
      const url = new URL(request.url);
      const path = url.pathname
        .replace(/^\/api\//, "")
        .split("/")
        .filter(Boolean);
      const method = request.method;
      const write = method !== "GET" && method !== "HEAD";
      if (write) requireSameOrigin(request, appUrl);
      let actor: CurrentUser | undefined;
      async function user() {
        return (actor ??= await currentUser());
      }
      async function admin() {
        const value = await user();
        if (!value.admin)
          throw new BackendError(
            "FORBIDDEN",
            "Administrator access required.",
            403,
          );
        return value.id;
      }
      async function body(maxBytes?: number) {
        return object.parse(await readJson(request, maxBytes));
      }
      const id = () => uuid.parse(path[2]);
      const rev = (b: Record<string, unknown>) => revision.parse(b.revision);

      if (method === "GET" && path[0] === "public") {
        if (path.length === 2) {
          if (path[1] === "stories")
            return json(await content.getPublishedStories(sql));
          if (path[1] === "announcements")
            return json(await content.getPublishedAnnouncements(sql));
          if (path[1] === "leadership")
            return json(await content.getPublishedLeadership(sql));
          if (path[1] === "resources")
            return json(await content.getResources(sql));
          if (path[1] === "club-info")
            return json(await content.getClubInfo(sql));
        }
        if (path[1] === "images" && path.length === 3) {
          const image = await content.getPublicImage(sql, id());
          return new Response(new Uint8Array(image.data), {
            headers: {
              ...privateHeaders,
              "Content-Type": image.mime_type,
              "Content-Disposition": "inline",
            },
          });
        }
      }
      if (path[0] === "me") {
        const actor = await user();
        if (method === "GET" && path.length === 1) return json(actor);
        if (path[1] === "applications") {
          if (path.length === 2 && method === "GET")
            return json(await getOwnApplications(sql, actor.id));
          if (path.length === 2 && method === "POST")
            return json(
              await submitApplication(sql, actor.id, await body()),
              201,
            );
          if (path.length === 3 && method === "GET")
            return json(
              await applications.getOwnApplicationDetail(sql, actor.id, id()),
            );
          if (
            path.length === 4 &&
            path[3] === "withdraw" &&
            method === "POST"
          ) {
            const b = await body();
            return json(
              await applications.withdrawOwnApplication(
                sql,
                actor.id,
                id(),
                rev(b),
              ),
            );
          }
        }
        if (path[1] === "membership" && path.length === 2 && method === "GET")
          return json(await members.getOwnMemberDetail(sql, actor.id));
        if (path[1] === "attendance" && path.length === 2 && method === "GET")
          return json(await attendance.getOwnAttendanceSummary(sql, actor.id));
        if (path[1] === "absences") {
          if (path.length === 2 && method === "GET")
            return json(await attendance.getOwnAbsenceNotices(sql, actor.id));
          if (path.length === 2 && method === "POST")
            return json(
              await attendance.createAbsenceNotice(sql, actor.id, await body()),
              201,
            );
          if (path.length === 4 && path[3] === "cancel" && method === "POST") {
            const b = await body();
            return json(
              await attendance.cancelAbsenceNotice(sql, actor.id, id(), rev(b)),
            );
          }
        }
      }
      if (path[0] === "calendar" && path.length === 1 && method === "GET") {
        const actor = await user();
        return json(await sessions.getCurrentCalendar(sql, actor.id));
      }
      if (path[0] === "sessions" && path.length <= 2 && method === "GET") {
        const actor = await user();
        if (path.length === 2)
          return json(
            await sessions.getSessionDetail(sql, actor.id, uuid.parse(path[1])),
          );
        if (
          url.searchParams.has("termId") &&
          url.searchParams.has("academicYearId")
        )
          throw new BackendError(
            "INVALID_INPUT",
            "Choose an academic year or a term filter.",
            400,
          );
        if (url.searchParams.has("termId"))
          return json(
            await sessions.getSessionsByTerm(
              sql,
              actor.id,
              uuid.parse(url.searchParams.get("termId")),
            ),
          );
        if (url.searchParams.has("academicYearId"))
          return json(
            await sessions.getSessionsByAcademicYear(
              sql,
              actor.id,
              uuid.parse(url.searchParams.get("academicYearId")),
            ),
          );
        return json(await sessions.getUpcomingSessions(sql, actor.id));
      }
      if (path[0] === "admin") {
        const actor = await admin();
        if (path[1] === "applications") {
          if (path.length === 2 && method === "GET")
            return json(
              await applications.listApplicationQueue(sql, actor, {
                status: url.searchParams.get("status") ?? "submitted",
              }),
            );
          if (path.length === 3 && method === "GET")
            return json(
              await applications.getAdminApplicationDetail(sql, actor, id()),
            );
          if (path.length === 4 && method === "POST") {
            const b = await body();
            if (path[3] === "accept")
              return json({
                memberId: await applications.acceptApplicationReview(
                  sql,
                  actor,
                  id(),
                  rev(b),
                  b.memberCard,
                ),
              });
            if (path[3] === "status")
              return json(
                await applications.transitionApplication(
                  sql,
                  actor,
                  id(),
                  rev(b),
                  z.enum(["under_review", "rejected"]).parse(b.status),
                  z
                    .string()
                    .max(256)
                    .nullable()
                    .parse(b.reason ?? null),
                ),
              );
          }
        }
        if (path[1] === "members") {
          if (path.length === 2 && method === "GET")
            return json(
              await members.listMembers(
                sql,
                actor,
                url.searchParams.get("status") ?? "active",
              ),
            );
          if (path.length === 3 && method === "GET")
            return json(await members.getAdminMemberDetail(sql, actor, id()));
          if (path.length === 3 && method === "PUT") {
            const b = await body();
            return json(
              await members.updateMemberCard(sql, actor, id(), rev(b), b),
            );
          }
          if (path.length === 4 && path[3] === "state" && method === "POST") {
            const b = await body();
            return json(
              await members.changeMembershipState(sql, actor, id(), rev(b), b),
            );
          }
        }
        if (
          path[1] === "identities" &&
          path.length === 4 &&
          method === "POST"
        ) {
          if (path[3] === "grant-admin")
            return json(await members.grantAdmin(sql, actor, id()));
          if (path[3] === "revoke-admin")
            return json(await members.revokeAdmin(sql, actor, id()));
          if (path[3] === "restrictions")
            return json(
              await members.createReapplicationRestriction(
                sql,
                actor,
                id(),
                await body(),
              ),
              201,
            );
        }
        if (
          path[1] === "restrictions" &&
          path.length === 4 &&
          path[3] === "end" &&
          method === "POST"
        )
          return json(
            await members.endReapplicationRestriction(sql, actor, id()),
          );
        if (
          (path[1] === "academic-years" || path[1] === "terms") &&
          path.length === 2
        ) {
          if (method === "GET")
            return json(
              path[1] === "academic-years"
                ? await sql`select * from meetings.academic_years order by starts_on desc`
                : await sql`select * from meetings.terms order by starts_on desc`,
            );
          if (method === "POST") {
            const b = await body();
            return json(
              path[1] === "academic-years"
                ? await sessions.createAcademicYear(sql, actor, b)
                : await sessions.createTerm(sql, actor, b),
              201,
            );
          }
          if (method === "PUT") {
            const b = await body();
            return json(
              path[1] === "academic-years"
                ? await sessions.updateAcademicYear(sql, actor, rev(b), b)
                : await sessions.updateTerm(sql, actor, rev(b), b),
            );
          }
        }
        if (path[1] === "sessions") {
          if (path.length === 2 && method === "POST")
            return json(
              await sessions.createSession(sql, actor, await body()),
              201,
            );
          if (path.length === 3 && method === "PUT") {
            const b = await body();
            return json(
              await sessions.updateSession(sql, actor, id(), rev(b), b),
            );
          }
          if (path.length === 4 && path[3] === "cancel" && method === "POST") {
            const b = await body();
            return json(await sessions.cancelSession(sql, actor, id(), rev(b)));
          }
          if (path.length === 4 && path[3] === "attendance") {
            if (method === "GET")
              return json(
                await attendance.getSessionAttendance(sql, actor, id()),
              );
            if (method === "PUT") {
              const b = await body();
              return json(
                await attendance.saveSessionAttendance(
                  sql,
                  actor,
                  id(),
                  rev(b),
                  b.records,
                ),
              );
            }
          }
        }
        if (path[1] === "absences" && path.length === 2 && method === "GET")
          return json(await attendance.getAdminAbsenceNotices(sql, actor));
        if (
          path[1] === "absences" &&
          path.length === 4 &&
          path[3] === "acknowledge" &&
          method === "POST"
        ) {
          const b = await body();
          return json(
            await attendance.acknowledgeAbsenceNotice(sql, actor, id(), rev(b)),
          );
        }
        if (
          path[1] === "content" &&
          (path.length === 3 || path.length === 4) &&
          (path[2] !== "club-info" || path.length === 3)
        ) {
          const kind = path[2];
          const entity = path[3] ? uuid.parse(path[3]) : undefined;
          if (method === "GET") {
            if (kind === "images" && entity) {
              const image = await content.getAdminImage(sql, actor, entity);
              return new Response(new Uint8Array(image.data), {
                headers: {
                  ...privateHeaders,
                  "Content-Type": image.mime_type,
                  "Content-Disposition": "inline",
                },
              });
            }
            if (kind === "stories")
              return json(
                entity
                  ? await content.getAdminStory(sql, actor, entity)
                  : await content.listAdminStories(sql, actor),
              );
            if (kind === "announcements")
              return json(
                entity
                  ? await content.getAdminAnnouncement(sql, actor, entity)
                  : await content.listAdminAnnouncements(sql, actor),
              );
            if (kind === "leadership")
              return json(
                entity
                  ? await content.getAdminLeadershipProfile(sql, actor, entity)
                  : await content.listAdminLeadership(sql, actor),
              );
            if (kind === "resources")
              return json(
                entity
                  ? await content.getAdminResource(sql, actor, entity)
                  : await content.listAdminResources(sql, actor),
              );
            if (kind === "club-info")
              return json(await content.getAdminClubInfo(sql, actor));
          }
          if (method === "POST" || method === "PUT") {
            const b = await body(3 * 1024 * 1024);
            let upload;
            if (b.upload !== undefined) {
              const u = z
                .object({
                  base64: z
                    .string()
                    .max(2_796_204)
                    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
                  mimeType: z.enum([
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/gif",
                  ]),
                  altText: z.string().min(1).max(300),
                })
                .parse(b.upload);
              upload = {
                data: Buffer.from(u.base64, "base64"),
                mimeType: u.mimeType,
                altText: u.altText,
              };
            }
            if (method === "POST" && !entity) {
              if (kind === "stories")
                return json(
                  await content.createStory(sql, actor, b, upload),
                  201,
                );
              if (kind === "announcements")
                return json(
                  await content.createAnnouncement(sql, actor, b, upload),
                  201,
                );
              if (kind === "leadership")
                return json(
                  await content.createLeadershipProfile(sql, actor, b),
                  201,
                );
              if (kind === "resources")
                return json(await content.createResource(sql, actor, b), 201);
              if (kind === "club-info")
                return json(await content.createClubInfo(sql, actor, b), 201);
              if (kind === "images" && upload)
                return json(await content.createImage(sql, actor, upload), 201);
            }
            if (method === "PUT" && entity) {
              if (kind === "stories")
                return json(
                  await content.updateStory(
                    sql,
                    actor,
                    entity,
                    rev(b),
                    b,
                    upload,
                  ),
                );
              if (kind === "announcements")
                return json(
                  await content.updateAnnouncement(
                    sql,
                    actor,
                    entity,
                    rev(b),
                    b,
                    upload,
                  ),
                );
              if (kind === "leadership")
                return json(
                  await content.updateLeadershipProfile(
                    sql,
                    actor,
                    entity,
                    rev(b),
                    b,
                  ),
                );
              if (kind === "resources")
                return json(
                  await content.updateResource(sql, actor, entity, rev(b), b),
                );
            }
            if (method === "PUT" && kind === "club-info")
              return json(await content.updateClubInfo(sql, actor, rev(b), b));
          }
        }
      }
      throw new BackendError("NOT_FOUND", "API endpoint not found.", 404);
    });
}
