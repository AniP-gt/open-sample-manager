import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { collectDirectoriesFromPaths } from "./samplePathHelpers";

export function useSampleLibraryPaths() {
  const [scannedPaths, setScannedPaths] = useState<string[]>([]);
  const [allSamplePaths, setAllSamplePaths] = useState<string[]>([]);
  const fetchAllSamplePaths = useCallback(async () => {
    try {
      const paths = await invoke<string[]>("list_all_sample_paths");
      setAllSamplePaths(paths);
    } catch (e) {
      console.error("Failed to fetch all sample paths:", e);
    }
  }, []);

  useEffect(() => {
    void fetchAllSamplePaths();
  }, [fetchAllSamplePaths]);

  useEffect(() => {
    setScannedPaths(collectDirectoriesFromPaths(allSamplePaths));
  }, [allSamplePaths]);
  return { scannedPaths, setScannedPaths, allSamplePaths, setAllSamplePaths, fetchAllSamplePaths };
}
