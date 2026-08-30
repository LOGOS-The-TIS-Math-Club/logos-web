export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="w-full">
      <div className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Loading content...
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-12 md:gap-8 lg:gap-12">
        <div className="space-y-4 md:col-span-7 lg:col-span-8">
          <div className="rounded-component bg-surface-raised h-8 w-48 animate-pulse motion-reduce:animate-none" />
          <div className="rounded-component bg-surface h-5 w-full max-w-lg animate-pulse motion-reduce:animate-none" />
          <div className="rounded-component bg-surface h-4 w-3/4 max-w-md animate-pulse motion-reduce:animate-none" />
        </div>

        <div className="border-border space-y-6 border-t pt-8 md:col-span-5 md:border-t-0 md:border-l md:pt-0 md:pl-8 lg:col-span-4 lg:pl-10">
          <div className="rounded-component bg-surface-raised h-4 w-36 animate-pulse motion-reduce:animate-none" />
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="rounded-component bg-surface h-4 w-32 animate-pulse motion-reduce:animate-none" />
              <div className="rounded-component bg-surface h-3 w-56 animate-pulse motion-reduce:animate-none" />
            </div>
            <div className="space-y-2">
              <div className="rounded-component bg-surface h-4 w-28 animate-pulse motion-reduce:animate-none" />
              <div className="rounded-component bg-surface h-3 w-52 animate-pulse motion-reduce:animate-none" />
            </div>
            <div className="space-y-2">
              <div className="rounded-component bg-surface h-4 w-36 animate-pulse motion-reduce:animate-none" />
              <div className="rounded-component bg-surface h-3 w-60 animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
