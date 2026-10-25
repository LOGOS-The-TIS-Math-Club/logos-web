import { createElement, type ReactNode } from "react";
export default function Layout({ children }: { children: ReactNode }) {
  return createElement(
    "html",
    { lang: "en" },
    createElement("body", null, children),
  );
}
