import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Container } from "./container";

describe("Container", () => {
  it("renders children accessibly", () => {
    render(
      <Container>
        <p>Container content</p>
      </Container>,
    );

    expect(screen.getByText("Container content")).toBeInTheDocument();
  });

  it("applies custom className alongside layout styling", () => {
    const { container } = render(
      <Container className="custom-container-class">
        <p>Content</p>
      </Container>,
    );

    const containerElement = container.firstElementChild;
    expect(containerElement).toHaveClass("custom-container-class");
    expect(containerElement).toHaveClass("max-w-7xl");
  });

  it("passes through HTML attributes to the element", () => {
    render(
      <Container aria-label="Content container" role="region">
        <p>Content</p>
      </Container>,
    );

    expect(
      screen.getByRole("region", { name: "Content container" }),
    ).toBeInTheDocument();
  });
});
