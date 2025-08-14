import { useEffect, useState } from "react";
import Storage from "../lib/storage";

/**
 * Persist a primitive JSON-serializable value to AsyncStorage/localStorage.
 * - Loads once on mount (falls back to defaultValue when unset or invalid)
 * - Writes on change
 */
export function usePersistentState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await Storage.getItem(key);
        if (!mounted) return;
        if (raw == null || raw === "") {
          setValue(defaultValue);
        } else {
          try {
            setValue(JSON.parse(raw) as T);
          } catch {
            // Support legacy boolean/number string values
            // If parse fails, keep default
            setValue(defaultValue);
          }
        }
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, [key]);

  useEffect(() => {
    if (!loaded) return; // avoid writing before initial load
    try {
      Storage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value, loaded]);

  return [value, setValue] as const;
}
