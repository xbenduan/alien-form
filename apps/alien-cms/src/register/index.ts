import { RuntimeCore } from "../runtime";

const modules = import.meta.glob("./*/index.ts", { eager: true }) as Record<
  string,
  { default: (runtime: RuntimeCore) => import("../runtime").RegisterDescribe }
>;

export function registerAll(runtime = RuntimeCore.current): void {
  Object.entries(modules).forEach(([path, module]) => {
    const describe = module.default(runtime);
    const domain = path.split("/")[1];
    if (domain === "global") runtime.registerGlobal(describe);
    else runtime.registerDomain(describe, domain);
  });
}
