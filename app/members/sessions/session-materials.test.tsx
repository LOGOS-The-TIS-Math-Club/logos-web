import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionMaterials } from "./session-materials";

const file = {
  id: "file id/with spaces",
  name: "Week 1.pdf",
  mimeType: "application/pdf",
  webViewLink: null,
  modifiedTime: null,
  size: 2048,
};

describe("SessionMaterials", () => {
  it("shows a folder link and useful guidance when Drive listing is unconfigured", () => {
    render(
      <SessionMaterials
        folderId="folder id/1"
        driveConfigured={false}
        driveError={false}
        files={[]}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: /open session folder in google drive/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://drive.google.com/drive/folders/folder%20id%2F1",
    );
    expect(screen.getByText(/Drive is not connected/i)).toBeInTheDocument();
  });

  it("lists files with safely generated links", () => {
    render(
      <SessionMaterials
        folderId="folder-1"
        driveConfigured
        driveError={false}
        files={[file]}
      />,
    );

    expect(screen.getByText("Week 1.pdf").closest("a")).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/file%20id%2Fwith%20spaces/view",
    );
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("keeps the Drive folder available when listing fails", () => {
    render(
      <SessionMaterials
        folderId="folder-1"
        driveConfigured
        driveError
        files={[]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /open session folder/i }),
    ).toHaveAttribute(
      "href",
      "https://drive.google.com/drive/folders/folder-1",
    );
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("explains when there is no folder", () => {
    render(
      <SessionMaterials
        folderId={null}
        driveConfigured={false}
        driveError={false}
        files={[]}
      />,
    );

    expect(screen.getByText(/No materials folder/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
