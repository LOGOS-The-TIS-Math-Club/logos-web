"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

export interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ reset }: ErrorProps) {
  return (
    <section role="alert" aria-labelledby="error-heading" className="max-w-md">
      <div className="mb-4">
        <StatusBadge variant="danger">Error</StatusBadge>
      </div>
      <h1
        id="error-heading"
        className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl"
      >
        An unexpected error occurred
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        The application encountered an error while loading this page. Please try
        again or return to the home page.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={reset} variant="primary">
          Try again
        </Button>
        <Link
          href="/"
          className="rounded-component text-muted-foreground hover:text-foreground focus-visible:outline-focus inline-flex min-h-11 items-center justify-center px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          Return home
        </Link>
      </div>
    </section>
  );
}
