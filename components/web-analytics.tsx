"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";

const publicPaths = new Set(["/", "/about", "/join", "/meetings", "/members", "/privacy", "/story"]);

const publicPageView: BeforeSend = (event) => {
  const url = new URL(event.url, window.location.origin);
  if (event.type !== "pageview" || !publicPaths.has(url.pathname)) return null;

  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
};

export function WebAnalytics() {
  return <Analytics beforeSend={publicPageView} />;
}
