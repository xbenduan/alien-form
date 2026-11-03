import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { isObject, migrateLegacyDefinition } from "formwork/model";

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    output: { type: "string" },
    "layouts-migrated": { type: "boolean", default: false },
    "relation-labels": { type: "string" },
  },
});
if (!values.input || !values.output)
  throw new Error(
    "用法: tsx scripts/migrate-schema.ts --input old.json --output candidate.json [--layouts-migrated] [--relation-labels labels.json]",
  );
const input: unknown = JSON.parse(await readFile(resolve(values.input), "utf8"));
const definitions = Array.isArray(input) ? input : [input];
const targets = Object.fromEntries(
  definitions.flatMap((definition) =>
    isObject(definition) &&
    isObject(definition.document) &&
    typeof definition.document.id === "string"
      ? [[definition.document.id, definition]]
      : [],
  ),
);
const relationLabels = values["relation-labels"]
  ? (JSON.parse(await readFile(resolve(values["relation-labels"]), "utf8")) as Record<
      string,
      string
    >)
  : undefined;
const results = definitions.map((definition) =>
  migrateLegacyDefinition(definition, {
    layoutsMigrated: values["layouts-migrated"],
    targets,
    relationLabels,
  }),
);
const output = resolve(values.output);
await writeFile(
  output,
  `${JSON.stringify(Array.isArray(input) ? results : results[0], null, 2)}\n`,
  { flag: "wx" },
);
const count = results.reduce((sum, result) => sum + result.report.errors.length, 0);
console.log(`候选定义及诊断已写入 ${output}；${count} 个问题需要处理。原文件未修改。`);
if (count) process.exitCode = 1;
