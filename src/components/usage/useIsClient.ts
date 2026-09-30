"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during server rendering and hydration, true afterwards. Used for anything that depends on
// the viewer's time zone (dates, day buckets), which the server can't know.
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
