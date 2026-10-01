import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathnameState = vi.hoisted(() => ({
  pathname: "/admin/members/member-1",
}));
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.pathname,
}));

import { AdminNavigation } from "./admin-navigation";
import { ADMIN_SECTIONS } from "./admin-sections";

describe("AdminNavigation", () => {
  it("groups links and marks the current section, including nested routes", () => {
    render(<AdminNavigation sections={ADMIN_SECTIONS} />);

    expect(screen.getByRole("heading", { name: "Club" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Content" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Operations" }),
    ).toBeInTheDocument();

    const currentLink = screen.getByRole("link", { name: "Members" });
    expect(currentLink).toHaveAttribute("aria-current", "page");
    expect(currentLink).toHaveClass("control-primary");
    expect(screen.getByRole("link", { name: "Sessions" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
