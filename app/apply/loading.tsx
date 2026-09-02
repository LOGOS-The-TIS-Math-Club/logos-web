import { WaitingProblems } from "@/components/ui/waiting-problems";

/*
 * Shown the instant "Apply" is pressed.
 *
 * /apply is force-dynamic and resolves the Neon Auth session plus two database
 * reads before it can render. On the free Neon plan the compute suspends after
 * five minutes idle, so the first visitor after a quiet period waits for a cold
 * start. Rather than a bare spinner, give them a problem to chew on.
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
        <p className="eyebrow">Opening the application</p>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-balance">
          One moment.
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The application service sleeps when nobody has used it recently. It is
          waking up — this usually takes a few seconds.
        </p>
      </header>

      <WaitingProblems />

      <div className="border-border space-y-3 border-t pt-6">
        <div className="bg-surface-raised h-4 w-56 animate-pulse motion-reduce:animate-none" />
        <div className="bg-surface h-3 w-full animate-pulse motion-reduce:animate-none" />
        <div className="bg-surface h-3 w-4/5 animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}
