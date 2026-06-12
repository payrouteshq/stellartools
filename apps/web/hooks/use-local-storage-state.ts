import * as React from "react";

export const useLocalStorageState = <T>(
  key: string,
  defaultState: T | undefined
): [T | undefined, (newState: T | undefined) => void] => {
  // Initialize state directly from localStorage or use defaultState
  const [state, setState] = React.useState<T | undefined>(() => {
    if (typeof window === "undefined") return defaultState;

    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultState;
    } catch (e) {
      console.warn(`Error reading ${key} from localStorage:`, e);
      return defaultState;
    }
  });

  const setLocalStorageState = React.useCallback(
    (newState: T | undefined) => {
      const changed = state !== newState;
      if (!changed) {
        return;
      }
      setState(newState as T);
      if (newState === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newState));
      }
    },
    [state, key]
  );

  return [state, setLocalStorageState];
};
