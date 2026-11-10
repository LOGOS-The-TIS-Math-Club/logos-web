"use client";
import { ActionLink } from "../action.tsx";
import { Applications, ApplicationDetail } from "./applications.tsx";
import { Members, MemberDetail } from "./members.tsx";
import { Sessions, SessionEditor, CalendarSettings } from "./sessions.tsx";
import { ContentList, ContentEditor } from "./content.tsx";
import { Schedule } from "./schedule.tsx";
import Link from "next/link";
import { DashboardIcon } from "../dashboard/icon.tsx";
const tools = [
  [
    "applications",
    "Applications",
    "Read applications, record decisions, and review new member cards.",
  ],
  [
    "members",
    "Members",
    "Find members, update their information, and review attendance history.",
  ],
  [
    "sessions",
    "Sessions and attendance",
    "Academic years, terms, session details and attendance.",
  ],
  [
    "content",
    "Public content",
    "Announcements, stories, public profiles, resource links and club information.",
  ],
  [
    "schedule",
    "Recurring meetings",
    "Set regular meeting defaults and choose what appears publicly.",
  ],
];
export function AdminShell({
  path = [],
  access,
}: {
  path?: string[];
  access: string;
}) {
  if (access !== "ready")
    return (
      <div className="dashboard-page">
        <h1>Leadership controls</h1>
        <section className="home-panel">
          <h2>
            {access === "anonymous"
              ? "Sign in to continue"
              : access === "denied"
                ? "Administrator access required"
                : access === "unconfigured"
                  ? "School sign-in is unavailable"
                  : "Leadership access is unavailable"}
          </h2>
          <p>
            Leadership permissions are explicitly granted. Public leadership
            titles do not grant access.
          </p>
          <ActionLink
            href={`/auth/sign-in?${new URLSearchParams({ returnTo: "/admin" + (path.length ? "/" + path.join("/") : "") })}`}
          >
            Your account
          </ActionLink>
        </section>
      </div>
    );
  const [section, id, extra] = path;
  return (
    <div className="dashboard-page admin-page">
      <div className="dashboard-heading admin-heading">
        <div>
          <p className="eyebrow">LOGOS / LEADERSHIP</p>
          <h1>
            {tools.find((t) => t[0] === section)?.[1] ?? "Leadership controls"}
          </h1>
        </div>
        <ActionLink href="/dashboard">Member dashboard</ActionLink>
      </div>
      {section ? (
        <nav className="admin-breadcrumb" aria-label="Leadership navigation">
          <Link href="/admin">Leadership tools</Link>
          <span aria-hidden="true">/</span>
          <span>{tools.find((t) => t[0] === section)?.[1]}</span>
        </nav>
      ) : (
        <p className="admin-intro">
          Manage the club, keep session records, and maintain the public
          website.
        </p>
      )}
      {!section ? (
        <ul className="admin-tools admin-tool-grid">
          {tools.map(([href, title, description], index) => (
            <li key={href}>
              <Link href={`/admin/${href}`} className="admin-tool-link">
                <span className="admin-tool-index">0{index + 1}</span>
                <span>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </span>
                <DashboardIcon name="arrow" />
              </Link>
            </li>
          ))}
        </ul>
      ) : section === "applications" ? (
        id ? (
          <ApplicationDetail key={id} id={id} />
        ) : (
          <Applications />
        )
      ) : section === "members" ? (
        id ? (
          <MemberDetail key={id} id={id} />
        ) : (
          <Members />
        )
      ) : section === "sessions" ? (
        id === "calendar" ? (
          <CalendarSettings />
        ) : id ? (
          <SessionEditor key={id} id={id} />
        ) : (
          <Sessions />
        )
      ) : section === "content" ? (
        id && extra ? (
          <ContentEditor key={`${id}/${extra}`} kind={id} id={extra} />
        ) : (
          <ContentList kind={id} />
        )
      ) : (
        <Schedule />
      )}
    </div>
  );
}
