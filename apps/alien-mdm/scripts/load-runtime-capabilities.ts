import { resolve } from "node:path";
import { createServer } from "vite";

export async function loadRuntimeCapabilities(root: string): Promise<{
  components: unknown[];
  services: unknown[];
  utilities: unknown[];
  enums: unknown[];
}> {
  const appRoot = resolve(root, "apps/alien-mdm");
  const server = await createServer({
    root: appRoot,
    configFile: resolve(appRoot, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const module = (await server.ssrLoadModule(
      "/src/register/runtime-capabilities.ts",
    )) as typeof import("../src/register/runtime-capabilities.ts");
    return module.getGlobalCapabilities();
  } finally {
    await server.close();
  }
}
