export default function Home() {
  return (
    <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-12 md:gap-8 lg:gap-12">
      <section
        aria-labelledby="page-title"
        className="space-y-4 md:col-span-7 lg:col-span-8"
      >
        <h1
          id="page-title"
          className="text-primary text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          LOGOS Web
        </h1>
        <p className="text-foreground text-base leading-relaxed">
          The project foundation for The Tokyo International School Math Club is
          ready.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This release establishes the application shell, responsive grid
          foundation, and contrast-verified token architecture for upcoming club
          services.
        </p>
      </section>

      <section
        aria-labelledby="principles-heading"
        className="border-border space-y-6 border-t pt-8 md:col-span-5 md:border-t-0 md:border-l md:pt-0 md:pl-8 lg:col-span-4 lg:pl-10"
      >
        <h2
          id="principles-heading"
          className="text-foreground text-sm font-semibold tracking-wider uppercase"
        >
          Foundation Principles
        </h2>
        <div className="space-y-5">
          <div>
            <h3 className="text-foreground text-sm font-medium">
              Accessible Architecture
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Built with semantic landmarks, keyboard bypass navigation, and
              verified WCAG 2.2 AA contrast.
            </p>
          </div>
          <div>
            <h3 className="text-foreground text-sm font-medium">
              Disciplined Aesthetics
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Engineered with Tailwind zinc neutrals and focused mauve accents
              without decorative clutter.
            </p>
          </div>
          <div>
            <h3 className="text-foreground text-sm font-medium">
              Operational Simplicity
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Powered by React Server Components by default with zero external
              font requests.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
