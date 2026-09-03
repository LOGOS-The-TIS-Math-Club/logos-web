import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfileMenu } from "./profile-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const MEMBER = {
  email: "student@tokyois.com",
  avatarUrl: null,
  isMember: true,
  isLeadership: false,
} as const;

describe("ProfileMenu", () => {
  it("shows only the avatar until it is opened", () => {
    render(<ProfileMenu viewer={MEMBER} />);

    const trigger = screen.getByRole("button", { name: "Your account" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // The address is the thing that must not be on screen unprompted.
    expect(screen.queryByText(MEMBER.email)).not.toBeInTheDocument();
  });

  it("reveals the address and member destinations once opened", () => {
    render(<ProfileMenu viewer={MEMBER} />);

    fireEvent.click(screen.getByRole("button", { name: "Your account" }));

    expect(screen.getByText(MEMBER.email)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/members",
    );
    expect(
      screen.getByRole("link", { name: "Excuse an absence" }),
    ).toHaveAttribute("href", "/members#absence");
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<ProfileMenu viewer={MEMBER} />);

    const trigger = screen.getByRole("button", { name: "Your account" });
    fireEvent.click(trigger);
    expect(screen.getByText(MEMBER.email)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText(MEMBER.email)).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("withholds leadership tools from an ordinary member", () => {
    render(<ProfileMenu viewer={MEMBER} />);

    fireEvent.click(screen.getByRole("button", { name: "Your account" }));

    expect(
      screen.queryByRole("link", { name: "Leadership tools" }),
    ).not.toBeInTheDocument();
  });

  it("offers leadership tools when the viewer holds review access", () => {
    render(<ProfileMenu viewer={{ ...MEMBER, isLeadership: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Your account" }));

    expect(
      screen.getByRole("link", { name: "Leadership tools" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("points a signed-in non-member at their account status instead", () => {
    render(<ProfileMenu viewer={{ ...MEMBER, isMember: false }} />);

    fireEvent.click(screen.getByRole("button", { name: "Your account" }));

    expect(
      screen.queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Account status" }),
    ).toHaveAttribute("href", "/auth/status");
  });

  it("renders the Google avatar when the session carries one", () => {
    render(
      <ProfileMenu
        viewer={{
          ...MEMBER,
          avatarUrl: "https://lh3.googleusercontent.com/a/abc123",
        }}
      />,
    );

    // Decorative: the button already carries the accessible name.
    const avatar = document.querySelector("img");
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveAttribute("alt", "");
  });
});
