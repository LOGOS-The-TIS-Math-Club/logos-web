const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const detail = new RegExp(`^/admin/(?:applications|members)/${uuid}$`, "i");
const session = new RegExp(`^/admin/sessions/(?:new|calendar|${uuid})$`, "i");
const content = new RegExp(
  `^/admin/content/(?:stories|announcements|leadership|resources)(?:/(?:new|${uuid}))?$`,
  "i",
);
export function isLeadershipPath(path: string) {
  return (
    [
      "/admin",
      "/admin/applications",
      "/admin/members",
      "/admin/sessions",
      "/admin/content",
      "/admin/content/club-info",
      "/admin/content/club-info/edit",
      "/admin/schedule",
    ].includes(path) ||
    detail.test(path) ||
    session.test(path) ||
    content.test(path)
  );
}
