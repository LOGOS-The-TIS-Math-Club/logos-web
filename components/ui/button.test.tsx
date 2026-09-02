import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders with default type, variant, and size", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-primary", "text-primary-foreground");
    expect(button).toHaveClass("rounded-component");
  });

  it("fires onClick handler when enabled and clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);

    const button = screen.getByRole("button", { name: "Submit" });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("disables user interaction and applies disabled styling when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled Action
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Disabled Action" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass(
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
    );

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies all variant styling classes", () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass(
      "bg-secondary",
      "text-secondary-foreground",
      "hover:bg-secondary-hover",
      "active:bg-secondary-active",
    );

    rerender(<Button variant="outline">Outline</Button>);
    // Outline sits on the stronger border step so its edge stays legible
    // against the raised surfaces it is used on.
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass(
      "border-border-strong",
      "bg-transparent",
    );

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass(
      "bg-transparent",
      "border-transparent",
    );
  });

  it("applies all size classes satisfying minimum touch targets", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    const smallBtn = screen.getByRole("button", { name: "Small" });
    expect(smallBtn).toHaveClass("min-h-11", "text-xs");

    rerender(<Button size="md">Medium</Button>);
    const mediumBtn = screen.getByRole("button", { name: "Medium" });
    expect(mediumBtn).toHaveClass("min-h-11", "text-sm");

    rerender(<Button size="lg">Large</Button>);
    const largeBtn = screen.getByRole("button", { name: "Large" });
    expect(largeBtn).toHaveClass("min-h-11", "text-base");
  });

  it("supports submit type and custom attributes", () => {
    render(
      <Button type="submit" name="action" value="save">
        Save Form
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save Form" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("name", "action");
    expect(button).toHaveAttribute("value", "save");
  });
});
