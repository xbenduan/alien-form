import type { Runtime } from "@alien-form/engine";
import { registerGlobal } from "./global";
import registerOverrides from "./overrides";

type DomainModule = {
  default?: (runtime: Runtime, domain: string) => void;
};

const domainModules = import.meta.glob<DomainModule>("./*/index.ts", { eager: true });
const reserved = new Set(["global", "overrides"]);

export function registerAll(runtime: Runtime): void {
  registerGlobal(runtime);
  runtime.withGlobalOverrides(registerOverrides);
  for (const [path, module] of Object.entries(domainModules)) {
    const domain = path.split("/")[1];
    if (!domain || reserved.has(domain)) continue;
    module.default?.(runtime, domain);
  }
}
