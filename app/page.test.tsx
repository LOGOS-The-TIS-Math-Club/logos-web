import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("identifies the neutral LOGOS foundation accessibly", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "LOGOS Web" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/project foundation.*is ready/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/application shell, responsive grid foundation/i),
    ).toBeInTheDocument();
  });

  it("renders the foundation principles section with correct heading hierarchy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Foundation Principles" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Accessible Architecture",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Disciplined Aesthetics",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Operational Simplicity",
      }),
    ).toBeInTheDocument();
  });
});
