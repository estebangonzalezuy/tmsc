/* A figure's starting values arrive from the markdown as strings
   (`:::figure grid-columns columns=8`). These read them with a default, so a
   figure never has to trust the source. */

export type Params = Record<string, string>;

export function num(params: Params, key: string, def: number, min = -Infinity, max = Infinity): number {
  const v = Number(params[key]);
  if (!Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
}

export function pick<T extends string>(params: Params, key: string, options: readonly T[], def: T): T {
  const v = params[key] as T | undefined;
  return v !== undefined && options.includes(v) ? v : def;
}

export function bool(params: Params, key: string, def: boolean): boolean {
  const v = params[key];
  if (v === undefined) return def;
  return v !== "false" && v !== "0" && v !== "off";
}
