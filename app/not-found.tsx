import type { Metadata } from "next";
import Link from "next/link";

import { AppPage } from "@/components/layout/app-page";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <AppPage
      width="narrow"
      eyebrow="404"
      title="Page not found"
      lede="That page does not exist, or it has moved."
    >
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="action action-primary">
          <span className="action-label">Return home</span>
          <span className="action-label-hover" aria-hidden="true">
            Return home
          </span>
        </Link>
        <Link href="/join" className="action">
          <span className="action-label">How to join</span>
          <span className="action-label-hover" aria-hidden="true">
            How to join
          </span>
        </Link>
      </div>
    </AppPage>
  );
}
