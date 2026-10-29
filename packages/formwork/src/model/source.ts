import { checkAbort, FormworkError } from "./errors";
import { cloneJson } from "./pointer";
import { assertSnapshot } from "./schema";
import type { ModelSnapshot, ModelSource } from "./types";

/** 为生产打包快照创建只读完整源，每次读取返回独立 JSON。 */
export function createReadonlyModelSource(snapshots: readonly ModelSnapshot[]): ModelSource {
  const index = new Map<string, ModelSnapshot>();
  for (const input of snapshots) {
    const snapshot = assertSnapshot(input);
    if (index.has(snapshot.id)) throw new FormworkError("INVALID_MODEL", `重复模型 id ${snapshot.id}`);
    index.set(snapshot.id, { ...snapshot, writable: false });
  }
  return {
    async list(options) {
      checkAbort(options?.signal);
      return [...index.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ document: _document, completeness: _full, ...entry }) => cloneJson(entry as never));
    },
    async read(id, options) {
      checkAbort(options?.signal);
      const snapshot = index.get(id);
      if (!snapshot) throw new FormworkError("NOT_FOUND", `找不到模型 ${id}`);
      return cloneJson(snapshot as never);
    },
    async write() { throw new FormworkError("READ_ONLY", "构建产物中的模型源为只读"); },
  };
}
