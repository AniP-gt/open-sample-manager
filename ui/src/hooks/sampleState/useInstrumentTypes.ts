import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { InstrumentTypeRow } from "../../types/sample";

type UseInstrumentTypesParams = {
  setError: (message: string | null) => void;
};

export function useInstrumentTypes({ setError }: UseInstrumentTypesParams) {
  const [instrumentTypes, setInstrumentTypes] = useState<InstrumentTypeRow[]>([]);
  const [instrumentTypeModalOpen, setInstrumentTypeModalOpen] = useState(false);

  const fetchInstrumentTypes = useCallback(async () => {
    return invoke<InstrumentTypeRow[]>("get_instrument_types");
  }, []);

  const refreshInstrumentTypes = useCallback(async () => {
    const updated = await fetchInstrumentTypes();
    setInstrumentTypes(updated ?? []);
  }, [fetchInstrumentTypes]);

  useEffect(() => {
    fetchInstrumentTypes()
      .then((res) => setInstrumentTypes(res ?? []))
      .catch(console.error);
  }, [fetchInstrumentTypes]);

  const handleAddInstrumentType = useCallback(
    async (name: string) => {
      try {
        await invoke<number>("add_instrument_type", { name });
        await refreshInstrumentTypes();
      } catch (e) {
        setError(`Failed to add instrument type: ${e}`);
      }
    },
    [refreshInstrumentTypes, setError],
  );

  const handleDeleteInstrumentType = useCallback(
    async (id: number) => {
      try {
        await invoke<number>("delete_instrument_type", { id });
        await refreshInstrumentTypes();
      } catch (e) {
        setError(`Failed to delete instrument type: ${e}`);
      }
    },
    [refreshInstrumentTypes, setError],
  );

  const handleUpdateInstrumentType = useCallback(
    async (id: number, name: string) => {
      try {
        await invoke<number>("update_instrument_type", { id, name });
        await refreshInstrumentTypes();
      } catch (e) {
        setError(`Failed to update instrument type: ${e}`);
      }
    },
    [refreshInstrumentTypes, setError],
  );

  return {
    instrumentTypes,
    instrumentTypeModalOpen,
    setInstrumentTypeModalOpen,
    handleAddInstrumentType,
    handleDeleteInstrumentType,
    handleUpdateInstrumentType,
  };
}
