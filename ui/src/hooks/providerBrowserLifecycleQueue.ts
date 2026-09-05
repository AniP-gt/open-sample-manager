import { useCallback, useRef } from "react";

type LifecycleOperation = () => Promise<void>;
type PendingReconcile = { frame: number | null; readonly identity: symbol };

function continueAfterFailure(_error: unknown): undefined {
  return undefined;
}

export function useProviderBrowserLifecycleQueue() {
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingReconcileRef = useRef<PendingReconcile | null>(null);

  const enqueue = useCallback((operation: LifecycleOperation) => {
    const next = queueRef.current.then(operation, operation);
    queueRef.current = next.catch(continueAfterFailure);
    return next;
  }, []);

  const cancelReconcile = useCallback(() => {
    const pending = pendingReconcileRef.current;
    if (pending !== null && pending.frame !== null) cancelAnimationFrame(pending.frame);
    pendingReconcileRef.current = null;
  }, []);

  const enqueueReconcile = useCallback((operation: LifecycleOperation) => {
    if (pendingReconcileRef.current !== null) return;
    const pending: PendingReconcile = { frame: -1, identity: Symbol("provider-reconcile") };
    pendingReconcileRef.current = pending;
    const frame = requestAnimationFrame(() => {
      pending.frame = null;
      void enqueue(async () => {
        if (pendingReconcileRef.current?.identity !== pending.identity) return;
        await operation();
      }).finally(() => {
        if (pendingReconcileRef.current?.identity === pending.identity) pendingReconcileRef.current = null;
      });
    });
    if (pendingReconcileRef.current?.identity === pending.identity && pending.frame === -1) {
      pending.frame = frame;
    }
  }, [enqueue]);

  return { enqueue, enqueueReconcile, cancelReconcile };
}
