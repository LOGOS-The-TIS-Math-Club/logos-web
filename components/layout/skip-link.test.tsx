import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("renders with default text and target href", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("accepts custom target href and children", () => {
    render(<SkipLink href="#target-area">Skip to target</SkipLink>);

    const link = screen.getByRole("link", { name: "Skip to target" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#target-area");
  });

  it("includes focus-visible and keyboard bypass styling", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveClass("focus-visible:outline-2");
    expect(link).toHaveClass("focus:translate-y-0");
  });

  it("passes through additional anchor attributes and className", () => {
    render(
      <SkipLink
        className="custom-skip-class"
        data-navigation="skip"
        id="custom-skip-id"
      />,
    );

    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("id", "custom-skip-id");
    expect(link).toHaveClass("custom-skip-class");
  });
});
