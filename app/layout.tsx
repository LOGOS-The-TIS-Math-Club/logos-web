import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Lato, JetBrains_Mono, Montserrat } from "next/font/google";
import { cookies } from "next/headers.js";
import { Shell } from "../components/shell.tsx";
import "./globals.css";
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "LOGOS — Tokyo International School Math Club",
    template: "%s — LOGOS",
  },
  description:
    "The student-led mathematics club of Tokyo International School.",
  robots: { index: false, follow: false },
};
export default async function Layout({ children }: { children: ReactNode }) {
  const motion =
    (await cookies()).get("logos_motion")?.value === "off" ? "off" : "on";
  return (
    <html
      lang="en"
      data-motion={motion}
      className={`${lato.variable} ${montserrat.variable} ${mono.variable}`}
    >
      <body>
        <Shell motion={motion}>{children}</Shell>
      </body>
    </html>
  );
}
