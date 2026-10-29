import { FormworkError } from "./errors";
import type { JsonValue } from "./types";

/** 将字段名编码为 JSON Pointer 的一个段。 */
export function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

/** 解码 JSON Pointer；空串表示值根，禁止无效的波浪号转义。 */
export function pointerSegments(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/") || /~(?![01])/u.test(pointer))
    throw new FormworkError("INVALID_POINTER", `无效 JSON Pointer: ${pointer}`, [
      { path: pointer, code: "INVALID_POINTER", message: "需要 / 开头及 ~0/~1 转义" },
    ]);
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/** 仅沿自有属性读取 Pointer，数组段必须是规范的非负整数。 */
export function readPointer(value: unknown, pointer: string): unknown {
  for (const part of pointerSegments(pointer)) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, part))
      return undefined;
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/u.test(part)) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/** 复制普通 JSON 值，拒绝非 JSON 对象、非有限数和数组空洞。 */
export function cloneJson<T extends JsonValue | undefined>(value: T): T {
  if (value === undefined) return value;
  const ancestors = new Set<object>();
  const visit = (input: unknown): JsonValue => {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (Array.isArray(input)) {
      if (ancestors.has(input)) throw new FormworkError("INVALID_VALUE", "JSON 不能包含循环对象");
      ancestors.add(input);
      const result: JsonValue[] = [];
      for (let i = 0; i < input.length; i++) {
        if (!Object.hasOwn(input, i))
          throw new FormworkError("INVALID_VALUE", "JSON 数组不能包含空洞");
        result.push(visit(input[i]));
      }
      ancestors.delete(input);
      return result;
    }
    if (isObject(input)) {
      if (ancestors.has(input)) throw new FormworkError("INVALID_VALUE", "JSON 不能包含循环对象");
      ancestors.add(input);
      const result = Object.fromEntries(
        Object.entries(input).map(([key, child]) => [key, visit(child)]),
      );
      ancestors.delete(input);
      return result;
    }
    throw new FormworkError("INVALID_VALUE", "值必须是普通 JSON");
  };
  return visit(value) as T;
}

/** 判断值是否为普通对象，允许 null prototype 但不接受类实例。 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
