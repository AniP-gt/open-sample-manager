import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

type UseProviderDownloadRootParams = {
  readonly setProviderDownloadRoot: (directory: string | null) => void;
  readonly setError: (message: string | null) => void;
};

export function useProviderDownloadRoot({ setProviderDownloadRoot, setError }: UseProviderDownloadRootParams) {
  const selectProviderDownloadRoot = useCallback(async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select Provider Download Folder",
      });
      const directory = typeof selectedPath === "string" ? selectedPath : selectedPath?.[0];

      if (directory) setProviderDownloadRoot(directory);
    } catch {
      setError("Could not open the folder picker.");
    }
  }, [setError, setProviderDownloadRoot]);

  return { selectProviderDownloadRoot };
}
