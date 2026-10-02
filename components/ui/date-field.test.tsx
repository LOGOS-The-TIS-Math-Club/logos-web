import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateField } from "./date-field";

describe("DateField", () => {
  it("uses the custom calendar and returns a stable local date", () => {
    const onChange = vi.fn();
    render(
      <DateField
        id="session-date"
        label="Session Date"
        value="2026-10-02"
        onChange={onChange}
      />,
    );

    expect(screen.queryByDisplayValue("2026-10-02")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Session Date/ }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Friday, October 9, 2026" }),
    );
    expect(onChange).toHaveBeenCalledWith("2026-10-09");
    expect(screen.queryByText("October 2026")).not.toBeInTheDocument();
  });
});
