import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound, { metadata } from "./not-found";

describe("NotFound", () => {
  it("defines a distinct page title that uses the site template", () => {
    // The layout applies "%s — LOGOS", so this page supplies only its own
    // name. It previously hardcoded "| LOGOS Web", which did not match any
    // other page.
    expect(metadata.title).toBe("Page not found");
  });

  it("renders page not found heading and descriptive message", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("That page does not exist, or it has moved."),
    ).toBeInTheDocument();
  });

  it("provides an accessible return home link", () => {
    render(<NotFound />);

    const link = screen.getByRole("link", { name: "Return home" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
