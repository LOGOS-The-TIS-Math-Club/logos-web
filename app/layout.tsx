import type { Metadata } from "next";
import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

export const metadata: Metadata = {
  title: "LOGOS — The Tokyo International School Math Club",
  description:
    "LOGOS is the student-led high school mathematics club at Tokyo International School. Explore contest math, Olympiad problem solving, and collaborative workshops in Room 101.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
