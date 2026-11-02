import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { isObject } from "formwork/model";
import { migratePageLocalViews } from "../apps/service/src/migration/page-local-views";

const { values } = parseArgs({
  options: { input: { type: "string" }, output: { type: "string" } },
});
if (!values.input) throw new Error("请指定 --input 模型 document 或 definition JSON 文件");
const input: unknown = JSON.parse(await readFile(values.input, "utf8"));
if (!isObject(input)) throw new Error("输入必须是 JSON 对象");
const migrated = Object.hasOwn(input, "document")
  ? { ...input, document: migratePageLocalViews(input.document) }
  : migratePageLocalViews(input);
const result = `${JSON.stringify(migrated, null, 2)}\n`;
if (values.output) await writeFile(values.output, result, { flag: "wx" });
else process.stdout.write(result);
