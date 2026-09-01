import { headers } from "next/headers";

import { listApplicationsForReview } from "@/lib/applications/service.server";
import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import {
  type ApplicationAdminItem,
  ApplicationAdminView,
} from "./application-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage() {
  const requestHeaders = await headers();
  const correlationId =
    requestHeaders.get("x-correlation-id") || crypto.randomUUID();

  let applications: ApplicationAdminItem[] | null = null;
  let accessDenied = false;
  let serviceError = false;

  try {
    await requireCapability("application:review", correlationId);
    applications = (await listApplicationsForReview(
      correlationId,
    )) as unknown as ApplicationAdminItem[];
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      accessDenied = true;
    } else {
      serviceError = true;
    }
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-danger bg-danger-surface rounded-component space-y-3 border p-8">
          <h1 className="text-danger text-xl font-bold">403 • Access Denied</h1>
          <p className="text-foreground text-sm leading-relaxed">
            You do not have the required <code>application:review</code>{" "}
            capability to access student applications.
          </p>
          <p className="text-muted-foreground text-xs">
            Application data is restricted to authorized club operators.
          </p>
        </div>
      </div>
    );
  }

  if (serviceError || !applications) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-border bg-surface rounded-component space-y-3 border p-8">
          <h1 className="text-foreground text-xl font-bold">
            Service Unavailable
          </h1>
          <p className="text-muted-foreground text-sm">
            Unable to retrieve application records. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return <ApplicationAdminView initialApplications={applications} />;
}
