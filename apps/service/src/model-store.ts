import { createHash } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { checkAbort, FormworkError, modelDocumentSchema, modelIdPattern } from "formwork/model";
import type { ModelDocument, ModelSnapshot, ModelSource } from "formwork/model";
import { createSerialQueue, parseStored, readStored, writeStored } from "./storage.js";

/** 创建独立于本地模型和旧 D1 的完整远端开发源。 */
export function createModelStore(dataDir: string): ModelSource {
  const directory = join(dataDir, "models");
  const serial = createSerialQueue();
  const path = (id: string) => {
    if (!modelIdPattern.test(id)) throw new FormworkError("INVALID_MODEL", "非法模型 id");
    return join(directory, `${id}.json`);
  };
  const snapshot = (bytes: Buffer, id: string): ModelSnapshot => {
    const result = modelDocumentSchema.safeParse(parseStored(bytes));
    if (!result.success || result.data.id !== id) throw new FormworkError("INVALID_MODEL", `开发模型 ${id} 无效`);
    const document = result.data;
    return { id, title: document.title, revision: createHash("sha256").update(bytes).digest("hex"), location: { kind: "remote", uri: `formwork-development://models/${id}` }, writable: true, completeness: "full", document };
  };
  return {
    async list(options) {
      checkAbort(options?.signal);
      await mkdir(directory, { recursive: true });
      const entries = [];
      for (const name of (await readdir(directory)).filter((name) => name.endsWith(".json")).sort()) {
        const value = await this.read(name.slice(0, -5), options);
        const { document: _document, completeness: _full, ...entry } = value;
        entries.push(entry);
      }
      return entries;
    },
    async read(id, options) {
      checkAbort(options?.signal);
      const bytes = await readStored(path(id));
      if (!bytes) throw new FormworkError("NOT_FOUND", `找不到远端模型 ${id}`);
      checkAbort(options?.signal);
      return snapshot(bytes, id);
    },
    async write(document: ModelDocument, options) {
      const parsed = modelDocumentSchema.safeParse(document);
      if (!parsed.success) throw new FormworkError("INVALID_MODEL", parsed.error.message);
      if (!options || typeof options.ifRevision !== "string" && options.ifRevision !== null) throw new FormworkError("REVISION_CONFLICT", "必须提供 ifRevision");
      const file = path(document.id);
      return serial(document.id, async () => {
        checkAbort(options.signal);
        const bytes = await readStored(file);
        const current = bytes ? snapshot(bytes, document.id).revision : null;
        if (current !== options.ifRevision) throw new FormworkError("REVISION_CONFLICT", "远端模型版本已变化");
        checkAbort(options.signal);
        await writeStored(file, parsed.data);
        return snapshot((await readStored(file))!, document.id);
      });
    },
  };
}
