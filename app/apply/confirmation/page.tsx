import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ConfirmationPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 py-4 sm:py-8">
      <div className="panel space-y-6 p-6 sm:p-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StatusBadge variant="success">SUBMITTED</StatusBadge>
            <span className="text-muted-foreground text-xs">
              2026–2027 Year
            </span>
          </div>
          <h1 className="heading-1">Application Received</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Thank you for applying to LOGOS — The Tokyo International School
            Math Club. Your application has been successfully recorded.
          </p>
        </div>

        <div className="panel-raised space-y-3 p-5">
          <h2 className="text-foreground text-sm font-semibold">
            What Happens Next
          </h2>
          <ul className="text-muted-foreground space-y-2 text-xs leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>
                <strong>Application Review:</strong> Club leadership will review
                submissions on a rolling basis.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>
                <strong>Email Notification:</strong> Follow-up messages and
                orientation details will be sent directly to your verified TIS
                email address.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>
                <strong>Regular Sessions:</strong> Meetings are held every
                Friday after school from 15:30 to 16:30 in Room 101.
              </span>
            </li>
          </ul>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
