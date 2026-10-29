import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, matchesGlob, relative, resolve, sep } from "node:path";
import { checkAbort, FormworkError, modelDocumentSchema, modelIdPattern } from "formwork/model";
import type { ModelDocument, ModelSnapshot, ModelSource } from "formwork/model";

/** 配置唯一文件源；id 由索引解析，调用者不能指定任意文件路径。 */
export type FileModelSourceOptions = {
  root: string;
  models: readonly string[];
  onUpdate?: (snapshot: ModelSnapshot) => void;
  validate?: (document: ModelDocument) => void | Promise<void>;
};

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}
function staticRoot(root: string, pattern: string): string {
  const prefix = pattern.split(/[*?{[]/u)[0]!;
  return resolve(root, prefix.endsWith("/") ? prefix : dirname(prefix));
}
function revision(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** 创建按原始文件字节计算版本、串行条件写入的完整本地源。 */
export function createFileModelSource(
  options: FileModelSourceOptions,
): ModelSource & { refresh: () => Promise<void> } {
  const root = resolve(options.root);
  const allowed = options.models.map((pattern) => staticRoot(root, pattern));
  const locks = new Map<string, Promise<unknown>>();
  let index = new Map<string, string>();
  let indexing: Promise<void> | undefined;
  const checkPath = async (file: string) => {
    const canonical = await realpath(file);
    const canonicalRoot = await realpath(root);
    if (!inside(canonicalRoot, canonical))
      throw new FormworkError("FORBIDDEN", "模型必须位于项目内部");
    const permitted = await Promise.all(
      allowed.map(async (dir) => {
        try {
          return inside(await realpath(dir), canonical);
        } catch {
          return false;
        }
      }),
    );
    if (!permitted.some(Boolean)) throw new FormworkError("FORBIDDEN", "模型不在允许的目录中");
    return canonical;
  };
  const readFileSnapshot = async (file: string): Promise<ModelSnapshot> => {
    await checkPath(file);
    const bytes = await readFile(file);
    let input: unknown;
    try {
      input = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw new FormworkError("INVALID_MODEL", `${relative(root, file)}: ${String(error)}`);
    }
    const parsed = modelDocumentSchema.safeParse(input);
    if (!parsed.success)
      throw new FormworkError(
        "INVALID_MODEL",
        `无效模型 ${relative(root, file)}`,
        parsed.error.issues.map((issue) => ({
          path:
            "/" +
            issue.path
              .map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1"))
              .join("/"),
          code: "INVALID_MODEL",
          message: issue.message,
        })),
      );
    return {
      id: parsed.data.id,
      title: parsed.data.title,
      revision: revision(bytes),
      location: { kind: "local", path: relative(root, file).split(sep).join("/") },
      writable: true,
      completeness: "full",
      document: parsed.data,
    };
  };
  const refresh = async () => {
    if (indexing) return indexing;
    indexing = (async () => {
      const next = new Map<string, string>();
      const files = new Set<string>();
      const visited = new Set<string>();
      const walk = async (path: string) => {
        let canonical: string;
        try {
          canonical = await checkPath(path);
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
          throw error;
        }
        if (visited.has(canonical)) return;
        visited.add(canonical);
        if ((await stat(path)).isDirectory()) {
          for (const name of (await readdir(path)).sort()) await walk(resolve(path, name));
        } else {
          const rel = relative(root, path).split(sep).join("/");
          if (options.models.some((pattern) => matchesGlob(rel, pattern))) files.add(path);
        }
      };
      for (const dir of allowed) await walk(dir);
      for (const file of [...files].sort()) {
        if (!(await stat(file)).isFile()) continue;
        const snapshot = await readFileSnapshot(file);
        if (next.has(snapshot.id))
          throw new FormworkError("INVALID_MODEL", `重复模型 id ${snapshot.id}`, [
            { path: "/id", code: "INVALID_MODEL", message: `${next.get(snapshot.id)} 与 ${file}` },
          ]);
        next.set(snapshot.id, file);
      }
      index = next;
    })();
    try {
      await indexing;
    } finally {
      indexing = undefined;
    }
  };
  const read = async (modelId: string, signal?: AbortSignal) => {
    checkAbort(signal);
    if (!modelIdPattern.test(modelId)) throw new FormworkError("INVALID_MODEL", "无效模型 id");
    await refresh();
    const file = index.get(modelId);
    if (!file) throw new FormworkError("NOT_FOUND", `找不到模型 ${modelId}`);
    const snapshot = await readFileSnapshot(file);
    if (snapshot.id !== modelId) throw new FormworkError("INVALID_MODEL", "模型 id 已被外部修改");
    checkAbort(signal);
    return snapshot;
  };
  return {
    refresh,
    async list(options) {
      checkAbort(options?.signal);
      await refresh();
      const entries = await Promise.all(
        [...index.keys()].sort().map((id) => read(id, options?.signal)),
      );
      return entries.map(({ document: _document, completeness: _full, ...entry }) => entry);
    },
    read: (id, options) => read(id, options?.signal),
    async write(document, writeOptions) {
      checkAbort(writeOptions?.signal);
      if (
        !writeOptions ||
        (typeof writeOptions.ifRevision !== "string" && writeOptions.ifRevision !== null)
      )
        throw new FormworkError("REVISION_CONFLICT", "写入必须提供 ifRevision");
      const parsed = modelDocumentSchema.safeParse(document);
      if (!parsed.success) throw new FormworkError("INVALID_MODEL", parsed.error.message);
      document = parsed.data;
      const previous = locks.get(document.id) ?? Promise.resolve();
      const task = previous
        .catch(() => {})
        .then(async () => {
          checkAbort(writeOptions.signal);
          await refresh();
          const existing = index.get(document.id);
          let before: string | null = null;
          if (existing) before = (await readFileSnapshot(existing)).revision;
          if (before !== writeOptions.ifRevision)
            throw new FormworkError("REVISION_CONFLICT", `模型 ${document.id} 的版本已变化`);
          await options.validate?.(document);
          checkAbort(writeOptions.signal);
          const destination = existing ?? resolve(allowed[0] ?? root, document.id, "model.json");
          if (!allowed[0] || !inside(root, destination))
            throw new FormworkError("FORBIDDEN", "没有模型创建目录");
          // 在 mkdir 前核对最近存在的祖先，禁止通过目录 symlink 逃出项目。
          let ancestor = dirname(destination);
          while (true) {
            try {
              if (!inside(await realpath(root), await realpath(ancestor)))
                throw new FormworkError("FORBIDDEN", "创建目录位于项目外");
              break;
            } catch (error) {
              if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
                throw error;
              ancestor = dirname(ancestor);
            }
          }
          await mkdir(dirname(destination), { recursive: true });
          const parent = await realpath(dirname(destination));
          if (!inside(await realpath(root), parent))
            throw new FormworkError("FORBIDDEN", "创建目录位于项目外");
          const temp = resolve(parent, `.formwork-${randomUUID()}.tmp`);
          try {
            await writeFile(temp, `${JSON.stringify(document, null, 2)}\n`, { flag: "wx" });
            checkAbort(writeOptions.signal);
            // 进程内锁不涵盖外部编辑器；提交前再次比较原始文件字节。
            let current: string | null = null;
            try {
              current = revision(await readFile(destination));
            } catch (error) {
              if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
                throw error;
            }
            if (current !== before)
              throw new FormworkError("REVISION_CONFLICT", "提交前文件已被外部修改");
            await rename(temp, destination);
            index.set(document.id, destination);
            const snapshot = await readFileSnapshot(destination);
            options.onUpdate?.(snapshot);
            return snapshot;
          } finally {
            await rm(temp, { force: true });
          }
        });
      locks.set(document.id, task);
      try {
        return await task;
      } finally {
        if (locks.get(document.id) === task) locks.delete(document.id);
      }
    },
  };
}
