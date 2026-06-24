// Utilitaires de lecture/écriture par chemin pointé (ex: "investment.capex").

export function getByPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

// Écriture immuable : renvoie une copie profonde avec la valeur modifiée.
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone = structuredClone(obj) as any;
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
    if (cur === undefined) return clone;
  }
  const last = keys[keys.length - 1];
  if (typeof cur[last] === "number" && typeof value === "string") {
    const n = parseFloat(value);
    cur[last] = isNaN(n) ? cur[last] : n;
  } else {
    cur[last] = value;
  }
  return clone;
}
