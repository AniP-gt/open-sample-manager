import { describe, expect, it } from "vitest";
import { getLibraryImportFolderPath } from "../libraryMigration";

describe("getLibraryImportFolderPath", () => {
  it("returns parent folder when samples database is selected", () => {
    expect(getLibraryImportFolderPath("/Users/alice/export/samples.db")).toBe(
      "/Users/alice/export",
    );
  });

  it("normalizes Windows separators", () => {
    expect(getLibraryImportFolderPath("C:\\Users\\alice\\export\\samples.db")).toBe(
      "C:/Users/alice/export",
    );
  });

  it("rejects unrelated files", () => {
    expect(getLibraryImportFolderPath("/Users/alice/export/readme.txt")).toBeNull();
  });

  it("rejects manifest files", () => {
    expect(getLibraryImportFolderPath("/Users/alice/export/manifest.json")).toBeNull();
  });
});
