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
  });
});
