import { headers } from "next/headers";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import { listStoryEntries } from "@/lib/story/service.server";
import { StoryAdminView } from "./story-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminStoryPage() {
  const requestHeaders = await headers();
  const correlationId =
    requestHeaders.get("x-correlation-id") || crypto.randomUUID();

  let entries = null;
  let accessDenied = false;
  let serviceError = false;

  try {
    await requireCapability("content:manage", correlationId);
    entries = await listStoryEntries(correlationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) accessDenied = true;
    else serviceError = true;
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-danger bg-danger-surface rounded-component space-y-3 border p-8">
          <h1 className="text-danger text-xl font-bold">403 • Access Denied</h1>
          <p className="text-foreground text-sm leading-relaxed">
            You do not have the required <code>content:manage</code> capability
            to edit the club story.
          </p>
        </div>
      </div>
    );
  }

  if (serviceError || !entries) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-danger bg-danger-surface rounded-component space-y-3 border p-8">
          <h1 className="text-danger text-xl font-bold">Service unavailable</h1>
          <p className="text-foreground text-sm leading-relaxed">
            The club story could not be loaded. Please try again shortly.
          </p>
        </div>
      </div>
    );
  }

  return <StoryAdminView initialEntries={entries} />;
}
