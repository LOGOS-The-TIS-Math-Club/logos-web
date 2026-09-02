/*
 * Shown the instant "Apply" is pressed.
 *
 * /apply is force-dynamic and resolves the Neon Auth session plus two database
 * reads before it can render. On the free Neon plan the compute suspends after
 * five minutes idle, so the first visitor after a quiet period waits for a cold
 * start. This skeleton makes that wait legible instead of blank, and is shaped
 * like the page that follows so nothing jumps when it arrives.
 */
export default function ApplyLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto max-w-2xl space-y-8"
    >
      <span className="sr-only">Loading the application form…</span>

      <header className="space-y-3">
        <div className="bg-surface-raised h-9 w-72 max-w-full animate-pulse rounded motion-reduce:animate-none" />
        <div className="bg-surface h-4 w-96 max-w-full animate-pulse rounded motion-reduce:animate-none" />
      </header>

      <div className="panel space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <div className="bg-surface-raised h-5 w-64 max-w-full animate-pulse rounded motion-reduce:animate-none" />
          <div className="bg-surface h-4 w-full animate-pulse rounded motion-reduce:animate-none" />
          <div className="bg-surface h-4 w-4/5 animate-pulse rounded motion-reduce:animate-none" />
        </div>

        <div className="panel-raised space-y-2 p-4">
          <div className="bg-surface h-3 w-full animate-pulse rounded motion-reduce:animate-none" />
          <div className="bg-surface h-3 w-3/4 animate-pulse rounded motion-reduce:animate-none" />
        </div>

        <div className="bg-surface-raised h-11 w-56 animate-pulse rounded motion-reduce:animate-none" />
      </div>

      <p className="text-subtle-foreground text-center text-xs">
        Waking the application service…
      </p>
    </div>
  );
}
