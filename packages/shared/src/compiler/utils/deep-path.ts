import { isPluginMarker, type PluginMarker } from "../types";

/** 深路径读取。 */
export function getPath(target: unknown, path: (string | number)[]): unknown {
  let current: unknown = target;
  for (const key of path) {
    if (current == null) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** 深路径写入（就地修改；调用方保证 target 是可安全 mutate 的 clone）。 */
export function setPath(target: unknown, path: (string | number)[], value: unknown): void {
  if (path.length === 0) return;
  let current = target as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i += 1) {
    current = current[path[i]] as Record<string | number, unknown>;
  }
  current[path[path.length - 1]] = value;
}

/** 深路径删除（就地修改）。数组元素删除会留下空洞，marker 通常挂在对象键上。 */
export function deletePath(target: unknown, path: (string | number)[]): void {
  if (path.length === 0) return;
  let current = target as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (current == null) return;
    current = current[path[i]] as Record<string | number, unknown>;
  }
  if (current) delete current[path[path.length - 1]];
}

export interface FoundMarker {
  marker: PluginMarker;
  path: (string | number)[];
}

/**
 * 深度遍历任意值，收集所有 marker 及其位置。
 * marker 本身不再向内递归（其内部字段是插件参数，不参与二次派发）。
 */
export function collectMarkers(root: unknown): FoundMarker[] {
  const found: FoundMarker[] = [];
  const walk = (value: unknown, path: (string | number)[]) => {
    if (isPluginMarker(value)) {
      found.push({ marker: value, path });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...path, index]));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, [...path, key]);
      }
    }
  };
  walk(root, []);
  return found;
}
