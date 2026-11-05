// The catalog, live from disk in dev (/api/catalog), or bundled at build time
// so a static build still has every spec.

import { useCallback, useEffect, useState } from "react";
import type { Catalog, Spec, Specs } from "@core/types.ts";
import bundledCatalog from "@catalog/text-animations/catalog.json";

const bundledSpecs = import.meta.glob<Spec>("@catalog/text-animations/specs/*.json", { eager: true, import: "default" });

export type CatalogState = { catalog: Catalog; specs: Specs; live: boolean; refresh: () => Promise<unknown> };

function bundled(): Omit<CatalogState, "refresh"> {
  const specs: Specs = {};
  for (const s of Object.values(bundledSpecs)) specs[s.id] = s;
  return { catalog: bundledCatalog as Catalog, specs, live: false };
}

export function useCatalog(): CatalogState {
  const [state, setState] = useState(bundled);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/catalog");
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { catalog: Catalog; specs: Specs };
      setState({ ...data, live: true });
      return data;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}

export async function saveSpecToCatalog(spec: Spec, overwrite = false) {
  const r = await fetch("/api/specs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, overwrite }) });
  const body = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: string[] };
  return { status: r.status, ...body };
}
