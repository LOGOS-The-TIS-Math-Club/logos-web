import type { Capability } from "@/lib/auth/capabilities";

export const ADMIN_SECTIONS: readonly {
  href: string;
  label: string;
  group: "Club" | "Content" | "Operations";
  capability: Capability;
  description: string;
}[] = [
  {
    href: "/admin/applications",
    label: "Applications",
    group: "Club",
    capability: "application:review",
    description:
      "Read every submitted application, set its review status, and export the full list as CSV.",
  },
  {
    href: "/admin/announcements",
    label: "Announcements",
    group: "Content",
    capability: "announcement:manage",
    description:
      "Post and edit the notices on the home page. Published changes appear immediately, with no deploy.",
  },
  {
    href: "/admin/members",
    label: "Members",
    group: "Club",
    capability: "membership:read",
    description:
      "The active roster. Activate an accepted applicant into a member, or change a member's status.",
  },
  {
    href: "/admin/story",
    label: "Our story",
    group: "Content",
    capability: "content:manage",
    description:
      "The club's record with pictures, shown on the public story page. Drafts stay hidden until you publish them.",
  },
  {
    href: "/admin/resources",
    label: "Resources",
    group: "Content",
    capability: "resource:manage",
    description:
      "The link cards on the member dashboard — Classroom, the shared Drive, and anything else you add.",
  },
  {
    href: "/admin/sessions",
    label: "Sessions",
    group: "Club",
    capability: "session:manage",
    description: "Create and edit the Friday meeting sessions.",
  },
  {
    href: "/admin/attendance",
    label: "Attendance",
    group: "Club",
    capability: "attendance:record",
    description:
      "Record who attended each session, and review expected-absence notices members submitted.",
  },
  {
    href: "/admin/warnings",
    label: "Warnings",
    group: "Operations",
    capability: "warning:manage",
    description: "Manual warning records. Nothing here is automatic.",
  },
];
