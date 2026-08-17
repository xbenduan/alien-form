import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".trae",
  "dist",
  "node_modules",
]);
const checkedExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const removedPackageName = ["@alien-form", "cms"].join("/");
const violations = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
    } else if (checkedExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function addViolation(file, label, match) {
  const line = file.contents.slice(0, match.index).split("\n").length;
  violations.push(`${path.relative(root, file.path)}:${line} ${label}: ${match[0]}`);
}

const files = await collectFiles(root);
for (const filePath of files) {
  const file = {
    path: filePath,
    contents: await readFile(filePath, "utf8"),
  };

  const packageReference = file.contents.indexOf(removedPackageName);
  if (packageReference >= 0) {
    addViolation(file, "removed package reference", {
      index: packageReference,
      0: removedPackageName,
    });
  }

  if (!filePath.startsWith(path.join(root, "packages/shared") + path.sep)) {
    continue;
  }

  const checks = [
    ["CMS identifier", /\bCms[A-Za-z0-9_$]*/g],
    ["CMS schema key", /\bx-(?:cms|model)\b/gi],
    ["CRUD concept", /\bcrud\b/gi],
  ];
  for (const [label, pattern] of checks) {
    for (const match of file.contents.matchAll(pattern)) {
      addViolation(file, label, match);
    }
  }

  for (const match of file.contents.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    const identifier = match[0];
    const isReactFormProvider = identifier === "FormProvider";
    const isContextProperty =
      identifier === "Provider" && file.contents[match.index - 1] === ".";
    if (
      identifier.endsWith("Provider") &&
      !isReactFormProvider &&
      !isContextProperty
    ) {
      addViolation(file, "Provider concept", match);
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture boundaries passed.");
}
