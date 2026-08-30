import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StatusBadgeVariant } from "./status-badge";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders with default neutral variant and pill radius", () => {
    render(<StatusBadge>Default Status</StatusBadge>);

    const badge = screen.getByText("Default Status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(
      "bg-muted",
      "text-muted-foreground",
      "rounded-full",
    );
  });

  it.each([
    ["neutral", "bg-muted", "text-muted-foreground"],
    ["success", "bg-success-surface", "text-success"],
    ["warning", "bg-warning-surface", "text-warning"],
    ["danger", "bg-danger-surface", "text-danger"],
    ["info", "bg-info-surface", "text-info"],
  ] as const)(
    "renders %s variant with expected semantic color token classes",
    (variant: StatusBadgeVariant, bgClass: string, textClass: string) => {
      render(
        <StatusBadge variant={variant}>{variant.toUpperCase()}</StatusBadge>,
      );

      const badge = screen.getByText(variant.toUpperCase());
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass(bgClass, textClass, "rounded-full");
    },
  );

  it("satisfies the color-not-only rule by requiring explicit readable text", () => {
    render(<StatusBadge variant="danger">System Offline</StatusBadge>);

    expect(screen.getByText("System Offline")).toBeInTheDocument();
  });

  it("passes through HTML attributes and custom className", () => {
    render(
      <StatusBadge
        variant="info"
        className="custom-badge-class"
        title="Informational notice"
      >
        Notice
      </StatusBadge>,
    );

    const badge = screen.getByText("Notice");
    expect(badge).toHaveClass("custom-badge-class");
    expect(badge).toHaveAttribute("title", "Informational notice");
  });
});
