import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorComponent from "./error";

describe("Error", () => {
  it("renders alert role, error heading, and status badge", () => {
    render(
      <ErrorComponent error={new Error("Test failure")} reset={() => {}} />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "An unexpected error occurred",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("sanitizes output by withholding stack traces, raw error messages, and sensitive diagnostics", () => {
    const sensitiveError = new Error(
      "DATABASE_URL=postgres://user:pass@secret.db/prod at Object.query (/server/db.ts:42:10)",
    );
    (sensitiveError as Error & { digest?: string }).digest =
      "unauthorized_secret_digest_998877";

    render(<ErrorComponent error={sensitiveError} reset={() => {}} />);

    expect(screen.queryByText(/postgres:\/\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/DATABASE_URL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret\.db/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/server\/db\.ts/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/unauthorized_secret_digest_998877/),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "The application encountered an error while loading this page. Please try again or return to the home page.",
      ),
    ).toBeInTheDocument();
  });

  it("invokes reset callback when clicking the 'Try again' button", () => {
    const handleReset = vi.fn();
    render(
      <ErrorComponent
        error={new Error("Recoverable error")}
        reset={handleReset}
      />,
    );

    const tryAgainButton = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(tryAgainButton);

    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it("provides a navigation link to return home", () => {
    render(<ErrorComponent error={new Error("Error")} reset={() => {}} />);

    const homeLink = screen.getByRole("link", { name: "Return home" });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
