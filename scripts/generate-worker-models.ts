import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "oxfmt";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelsRoot = resolve(root, "apps/alien-worker/src/services/models");
const output = resolve(root, "apps/alien-worker/src/services/model-manifest.generated.ts");
const check = process.argv.includes("--check");

async function modelCodes(): Promise<string[]> {
  const entries = await readdir(modelsRoot, { withFileTypes: true });
  const rootFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
  if (rootFiles.length > 0) {
    throw new Error(
      `services/models 仅允许 {modelCode}/index.ts：${rootFiles.map(({ name }) => name).join(", ")}`,
    );
  }
  const codes = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  await Promise.all(
    codes.map(async (code) => {
      const entry = await stat(resolve(modelsRoot, code, "index.ts")).catch(() => undefined);
      if (!entry?.isFile()) throw new Error(`模型目录 ${code} 缺少 index.ts`);
    }),
  );
  return codes;
}

async function main(): Promise<void> {
  const codes = await modelCodes();
  const source = `/**
 * Generated from services/models/{modelCode}/index.ts files.
 * Run \`pnpm generate:worker-models\` after adding or removing a model module.
 */
export const MODEL_MODULE_LOADERS = {
${codes.map((code) => `  ${JSON.stringify(code)}: () => import("./models/${code}/index.ts"),`).join("\n")}
} as const;
`;
  const result = await format(output, source);
  if (result.errors.length > 0) {
    throw new Error(result.errors.map(({ message }) => message).join("; "));
  }
  if (check) {
    const actual = await readFile(output, "utf8").catch(() => undefined);
    if (actual !== result.code) {
      throw new Error(`${relative(root, output)} 已漂移，请运行 pnpm generate:worker-models`);
    }
  } else {
    await writeFile(output, result.code);
  }
  console.log(`${codes.length} model modules ${check ? "checked" : "generated"}`);
}

void main();
