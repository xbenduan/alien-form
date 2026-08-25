import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const coreDir = path.join(root, "src", "core");
const violations = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path.join(directory, entry.name))));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

const files = await collectFiles(coreDir);
for (const filePath of files) {
  const content = await readFile(filePath, "utf8");
  const rel = path.relative(root, filePath);

  if (/from\s+["']react["']/.test(content)) {
    violations.push(`${rel}: core layer must not import "react"`);
  }
  if (/from\s+["']react-dom[^"']*["']/.test(content)) {
    violations.push(`${rel}: core layer must not import "react-dom"`);
  }
  if (/from\s+["']\.\.\/react\//.test(content) || /from\s+["']\.\.\/\.\.\/react\//.test(content)) {
    violations.push(`${rel}: core layer must not import from react bridge`);
  }
  if (filePath.endsWith(".tsx")) {
    violations.push(`${rel}: core layer must not contain .tsx files`);
  }
}

if (violations.length) {
  console.error("Boundary violations:\n" + violations.join("\n"));
  process.exit(1);
} else {
  console.log("Engine boundaries passed.");
}
