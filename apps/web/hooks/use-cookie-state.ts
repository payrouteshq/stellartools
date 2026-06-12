import * as React from "react";

import Cookies from "js-cookie";

interface CookieOptions {
  expires?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
}

export function useCookieState<T>(key: string, initialValue: T, options: CookieOptions = { expires: 365, path: "/" }) {
  const [value, setValue] = React.useState<T>(() => {
    if (typeof window !== "undefined") {
      const cookie = Cookies.get(key);
      if (cookie) {
        try {
          return JSON.parse(cookie);
        } catch (e) {
          console.error("Error parsing cookie:", e);
        }
      }
    }
    return initialValue;
  });

  const updateCookie = React.useCallback(
    (newValue: T | ((val: T) => T)) => {
      setValue((prev) => {
        const valueToStore = newValue instanceof Function ? newValue(prev) : newValue;

        if (valueToStore === null || valueToStore === undefined) {
          Cookies.remove(key);
        } else {
          Cookies.set(key, JSON.stringify(valueToStore), options);
        }

        return valueToStore;
      });
    },
    [key, options]
  );

  return [value, updateCookie] as const;
}
