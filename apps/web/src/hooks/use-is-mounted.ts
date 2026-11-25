"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * React 19 / Concurrent-safe hook to detect client-side hydration.
 * Uses `useSyncExternalStore` to avoid cascading render lint errors from `useEffect + setState`.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

