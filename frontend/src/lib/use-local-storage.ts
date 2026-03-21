import { useState, useCallback } from 'react';

/**
 * useState backed by localStorage. Falls back to defaultValue if
 * the key is missing or JSON.parse fails.
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // quota exceeded or private browsing — ignore
      }
    },
    [key],
  );

  return [value, set];
}
