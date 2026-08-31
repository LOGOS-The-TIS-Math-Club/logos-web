import * as Sentry from "@sentry/nextjs";
import { createHardenedSentryConfig } from "./lib/security/telemetry";

const config = createHardenedSentryConfig();
if (config) {
  Sentry.init(config);
}
