import Storage from "@/lib/storage";
import { useEffect, useRef, useState } from "react";

// Persist arbitrary JSON-serializable state into Storage (AsyncStorage or localStorage).
// Returns [value, setValue, ready] where ready indicates the initial load has completed.
export function usePersistedState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);
  const keyRef = useRef(key);

  // Load on mount or when key changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await Storage.getItem(keyRef.current);
        if (!cancelled && raw) {
          try {
            const parsed = JSON.parse(raw) as T;
            setValue(parsed);
          } catch {
            // ignore invalid JSON, fall back to initialValue
          }
        }
      } catch {
        // ignore storage errors
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist when value changes after initial load
  useEffect(() => {
    if (!ready) return;
    try {
      Storage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  }, [value, ready]);

  return [value, setValue, ready];
}
