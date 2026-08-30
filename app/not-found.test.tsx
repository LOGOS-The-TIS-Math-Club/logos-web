import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("renders page not found heading and descriptive message", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The requested page does not exist or has been moved."),
    ).toBeInTheDocument();
  });

  it("provides an accessible return home link", () => {
    render(<NotFound />);

    const link = screen.getByRole("link", { name: "Return home" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
