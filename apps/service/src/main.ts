import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDevelopmentService } from "./app.js";
import { seedDevelopment } from "./seed.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const project = createHash("sha256").update(root).digest("hex").slice(0, 16);
const directory =
  process.env.FORMWORK_DATA_DIR ??
  resolve(homedir(), ".local/share/alien-form/development", project);
const port = Number(process.env.FORMWORK_SERVICE_PORT ?? "8788");
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("FORMWORK_SERVICE_PORT 必须是有效端口");
const service = createDevelopmentService(directory);
await seedDevelopment(service, [
  resolve(root, "apps/client/src/models/orders/model.json"),
  resolve(root, "apps/client/src/domains/cms/model.json"),
]);
console.log(`Formwork development service: ${await service.listen(port)}\nData: ${directory}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void service.close().then(() => {
      process.exitCode = 0;
    });
  });
