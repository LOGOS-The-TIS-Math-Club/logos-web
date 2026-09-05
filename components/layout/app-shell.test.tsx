import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders all core semantic landmarks", () => {
    render(
      <AppShell>
        <p>Main content area</p>
      </AppShell>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("structures the main content landmark with #main-content and tabindex -1", () => {
    render(
      <AppShell>
        <p>Page body</p>
      </AppShell>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Page body")).toBeInTheDocument();
  });

  it("renders the skip link targeting #main-content", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const skipLink = screen.getByRole("link", {
      name: "Skip to main content",
    });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("uses the brandmark as the accessible link home", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const homeLink = screen.getByRole("link", { name: "LOGOS — home" });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("keeps the application action reachable from the header", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const applyLink = screen.getByRole("link", { name: /apply/i });
    expect(nav).toContainElement(applyLink);
    expect(applyLink).toHaveAttribute("href", "/apply");
  });

  it("applies 44px target sizing conventions to the header brand link", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "LOGOS — home" })).toHaveClass(
      "inline-flex",
      "min-h-11",
      "items-center",
      "px-2",
    );
  });

  it("names the organisation for assistive technology despite a decorative lockup", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(
      "The Tokyo International School Math Club",
    );
    expect(footer).toHaveTextContent("MIT License");
  });

  it("offers the application action to a signed-out visitor", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /apply/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Your account" }),
    ).not.toBeInTheDocument();
  });

  it("replaces the application action with a profile control for a member", () => {
    render(
      <AppShell
        viewer={{
          email: "student@tokyois.com",
          avatarUrl: null,
          isMember: true,
          isLeadership: false,
        }}
      >
        <p>Content</p>
      </AppShell>,
    );

    // A member has already joined; inviting them to apply again is noise.
    expect(
      screen.queryByRole("link", { name: /apply/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Your account" }),
    ).toBeInTheDocument();
  });

  it("keeps the application action for a signed-in visitor who is not a member", () => {
    render(
      <AppShell
        viewer={{
          email: "applicant@tokyois.com",
          avatarUrl: null,
          isMember: false,
          isLeadership: false,
        }}
      >
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /apply/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Your account" }),
    ).toBeInTheDocument();
  });

  it("never shows the address in the collapsed header", () => {
    render(
      <AppShell
        viewer={{
          email: "student@tokyois.com",
          avatarUrl: null,
          isMember: true,
          isLeadership: false,
        }}
      >
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByRole("banner")).not.toHaveTextContent(
      "student@tokyois.com",
    );
  });

  it("applies custom className to the main landmark", () => {
    render(
      <AppShell className="custom-shell-main">
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByRole("main")).toHaveClass("custom-shell-main");
  });
});

describe("AppShell header actions", () => {
  it("offers sign-in to a signed-out visitor alongside Apply", () => {
    // A returning member has no other route back into their hub short of
    // typing the URL.
    render(<AppShell>content</AppShell>);

    expect(screen.getByRole("link", { name: /^apply$/i })).toHaveAttribute(
      "href",
      "/apply",
    );
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/auth/sign-in",
    );
  });

  it("replaces sign-in with the profile menu once signed in", () => {
    render(
      <AppShell
        viewer={{
          email: "student@tokyois.com",
          avatarUrl: null,
          isMember: true,
          isLeadership: false,
        }}
      >
        content
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });

  it("keeps Apply hidden from members, who have already applied", () => {
    render(
      <AppShell
        viewer={{
          email: "student@tokyois.com",
          avatarUrl: null,
          isMember: true,
          isLeadership: false,
        }}
      >
        content
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /^apply$/i })).toBeNull();
  });
});
