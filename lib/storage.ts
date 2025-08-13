type StorageLike = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

const Storage: StorageLike = (() => {
  try {
    const AS = require("@react-native-async-storage/async-storage").default;
    return {
      getItem: (k: string) => AS.getItem(k),
      setItem: (k: string, v: string) => AS.setItem(k, v),
    };
  } catch {
    return {
      getItem: async (k: string) =>
        typeof window !== "undefined" && (window as any).localStorage
          ? (window as any).localStorage.getItem(k)
          : null,
      setItem: async (k: string, v: string) => {
        if (typeof window !== "undefined" && (window as any).localStorage) {
          (window as any).localStorage.setItem(k, v);
        }
      },
    };
  }
})();

export default Storage;

export async function getBool(key: string, def = false): Promise<boolean> {
  const v = await Storage.getItem(key);
  if (v == null) return def;
  return v === "1" || v === "true";
}

export async function setBool(key: string, v: boolean): Promise<void> {
  return Storage.setItem(key, v ? "1" : "0");
}

export async function getNumber(key: string, def = 0): Promise<number> {
  const v = await Storage.getItem(key);
  if (!v) return def;
  const n = parseFloat(v);
  return Number.isNaN(n) ? def : n;
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  return Storage.setItem(key, JSON.stringify(value));
}

export async function getJSON<T>(key: string, def: T): Promise<T> {
  const v = await Storage.getItem(key);
  if (!v) return def;
  try { return JSON.parse(v) as T; } catch { return def; }
}
