import { useCallback, useRef, useState } from "react";

type FreesoundErrorOwner = "browser" | "credential" | "preview" | "search";

export function useFreesoundErrorState() {
  const [error, setError] = useState<string | null>(null);
  const ownerRef = useRef<FreesoundErrorOwner | null>(null);
  const revisionRef = useRef(0);
  const beginErrorOperation = useCallback((owner: FreesoundErrorOwner) => {
    const revision = ++revisionRef.current;
    if (ownerRef.current === owner) {
      ownerRef.current = null;
      setError(null);
    }
    return revision;
  }, []);
  const setOwnedError = useCallback((owner: FreesoundErrorOwner, message: string, revision: number) => {
    if (revisionRef.current !== revision) return;
    ownerRef.current = owner;
    setError(message);
  }, []);

  return { beginErrorOperation, error, setOwnedError };
}
