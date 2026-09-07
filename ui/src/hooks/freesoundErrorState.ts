import { useCallback, useRef, useState } from "react";

type FreesoundErrorOwner = "browser" | "credential" | "preview" | "search";

export function useFreesoundErrorState() {
  const [error, setError] = useState<string | null>(null);
  const ownerRef = useRef<FreesoundErrorOwner | null>(null);
  const clearOwnedError = useCallback((owner: FreesoundErrorOwner) => {
    if (ownerRef.current !== owner) return;
    ownerRef.current = null;
    setError(null);
  }, []);
  const setOwnedError = useCallback((owner: FreesoundErrorOwner, message: string) => {
    ownerRef.current = owner;
    setError(message);
  }, []);

  return { clearOwnedError, error, setOwnedError };
}
