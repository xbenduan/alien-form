import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(appRoot, "dist");
const forbiddenPattern = /\bvitest\b/i;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = await collectFiles(distRoot);
const violations = [];

for (const file of files) {
  const contents = await readFile(file, "utf8");
  if (forbiddenPattern.test(contents)) {
    violations.push(path.relative(appRoot, file));
  }
}

if (violations.length > 0) {
  console.error(`Production output contains Vitest references:\n${violations.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Production output passed Vitest scan (${files.length} files checked).`);
}
