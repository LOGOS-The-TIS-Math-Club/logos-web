import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

/*
 * Inter and JetBrains Mono are the typefaces mandated for official LOGOS
 * material by logos-doc-standards §1.2. next/font self-hosts them, which also
 * satisfies the `font-src 'self'` Content-Security-Policy set in proxy.ts.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const siteUrl = process.env.APP_URL ?? "https://tislogos.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LOGOS — The Tokyo International School Math Club",
    template: "%s — LOGOS",
  },
  description:
    "LOGOS is the student-led mathematics club of Tokyo International School. We meet every Friday in Room 101 to work through problems that reward careful reasoning. Grades 9–12, no prior competition experience required.",
  applicationName: "LOGOS",
  openGraph: {
    type: "website",
    siteName: "LOGOS — The Tokyo International School Math Club",
    title: "LOGOS — The Tokyo International School Math Club",
    description:
      "Student-led mathematics at Tokyo International School. Fridays, 15:30–16:30, Room 101. Grades 9–12.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "LOGOS — The Tokyo International School Math Club",
    description:
      "Student-led mathematics at Tokyo International School. Fridays, 15:30–16:30, Room 101. Grades 9–12.",
  },
  // Kept from Phase 07. Flipping the site to indexable is a separate,
  // deliberate launch decision; proxy.ts also sets X-Robots-Tag.
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#100d12",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
