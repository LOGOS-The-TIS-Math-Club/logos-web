import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("Loading", () => {
  it("renders an accessible status container with polite live region and busy indicator", () => {
    render(<Loading />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("presents accessible loading announcement text", () => {
    render(<Loading />);

    expect(screen.getByText(/loading content/i)).toBeInTheDocument();
  });
});
