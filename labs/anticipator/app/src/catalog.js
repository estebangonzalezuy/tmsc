// The catalog, live from disk in dev (/api/catalog) or bundled at build time
// so a static deploy of the app still has every spec.

import { useCallback, useEffect, useState } from "react";

const bundledSpecs = import.meta.glob("@catalog/text-animations/specs/*.json", { eager: true, import: "default" });
import bundledCatalog from "@catalog/text-animations/catalog.json";

function bundled() {
  const specs = {};
  for (const mod of Object.values(bundledSpecs)) specs[mod.id] = mod;
  return { catalog: bundledCatalog, specs, live: false };
}

export function useCatalog() {
  const [state, setState] = useState(bundled);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/catalog");
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setState({ ...data, live: true });
      return data;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}

export async function saveSpecToCatalog(spec, overwrite = false) {
  const r = await fetch("/api/specs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spec, overwrite }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, ...body };
}
