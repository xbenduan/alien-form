import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FormworkError } from "formwork/model";

/** 为开发文件存储串行执行同一资源的操作。 */
export function createSerialQueue() {
  const locks = new Map<string, Promise<unknown>>();
  return async <T>(key: string, action: () => Promise<T>): Promise<T> => {
    const task = (locks.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
    locks.set(key, task);
    try {
      return await task;
    } finally {
      if (locks.get(key) === task) locks.delete(key);
    }
  };
}
/** 读取开发文件；不存在时返回 undefined，损坏文件明确失败。 */
export async function readStored(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}
/** 原子替换完整 JSON，临时文件不会成为可见记录。 */
export async function writeStored(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = join(dirname(file), `.formwork-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
/** 将存储损坏报告为明确服务错误。 */
export function parseStored(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new FormworkError("INVALID_DATA", "开发文件不是有效 JSON");
  }
}
