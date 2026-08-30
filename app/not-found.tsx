import Link from "next/link";

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-heading" className="max-w-md">
      <h1
        id="not-found-heading"
        className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl"
      >
        Page not found
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        The requested page does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="rounded-component bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active focus-visible:outline-focus inline-flex min-h-11 items-center justify-center px-4 py-2.5 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          Return home
        </Link>
      </div>
    </section>
  );
}
