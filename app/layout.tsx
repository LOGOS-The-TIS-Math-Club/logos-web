import type { Metadata } from "next";
import { connection } from "next/server";

import "./globals.css";

export const metadata: Metadata = {
  title: "LOGOS Web",
  description: "The website for The Tokyo International School Math Club.",
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
      <body>{children}</body>
    </html>
  );
}
