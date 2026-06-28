import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { LibraryExportSummary, LibraryImportSummary } from "../types/tauri";
import { getLibraryImportFolderPath } from "../utils/libraryMigration";
import { getErrorMessage } from "../utils/sampleMapper";

type UseLibraryMigrationParams = {
  readonly setError: (message: string | null) => void;
  readonly refreshAfterImport: () => Promise<void>;
};

type DialogPath = string | string[] | null;

export function useLibraryMigration({
  setError,
  refreshAfterImport,
}: UseLibraryMigrationParams) {
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  const selectFolder = useCallback(async (title: string): Promise<string | null> => {
    const selectedPath: DialogPath = await open({
      directory: true,
      multiple: false,
      title,
    });

    if (typeof selectedPath === "string") {
      return selectedPath;
    }

    return selectedPath?.[0] ?? null;
  }, []);

  const selectImportFolder = useCallback(async (): Promise<string | null> => {
    const selectedPath: DialogPath = await open({
      multiple: false,
      title: "Select samples.db to Import",
      filters: [
        {
          name: "Open Sample Manager Export",
          extensions: ["db"],
        },
      ],
    });

    const filePath = typeof selectedPath === "string" ? selectedPath : selectedPath?.[0];
    if (!filePath) {
      return null;
    }

    const folderPath = getLibraryImportFolderPath(filePath);
    if (!folderPath) {
      throw new Error("Select the exported samples.db file.");
    }

    return folderPath;
  }, []);

  const handleExportDatabase = useCallback(async () => {
    setError(null);
    try {
      const folderPath = await selectFolder("Select Export Folder");
      if (!folderPath) {
        return;
      }

      setMigrationBusy(true);
      setMigrationStatus(null);
      const summary = await invoke<LibraryExportSummary>("export_library_database", {
        folderPath,
      });
      setMigrationStatus(
        `Exported ${summary.sample_count} samples and ${summary.midi_count} MIDI files.`,
      );
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setMigrationBusy(false);
    }
  }, [selectFolder, setError]);

  const handleImportDatabase = useCallback(async () => {
    setError(null);
    try {
      const folderPath = await selectImportFolder();
      if (!folderPath) {
        return;
      }

      setMigrationBusy(true);
      setMigrationStatus(null);
      const summary = await invoke<LibraryImportSummary>("import_library_database", {
        folderPath,
      });
      await refreshAfterImport();
      setMigrationStatus(
        `Imported ${summary.sample_count} samples and ${summary.midi_count} MIDI files.`,
      );
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setMigrationBusy(false);
    }
  }, [refreshAfterImport, selectImportFolder, setError]);

  return {
    migrationBusy,
    migrationStatus,
    handleExportDatabase,
    handleImportDatabase,
  };
}
