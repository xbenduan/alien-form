/** URL 构造工具：集中管理路由路径，页面通过它做编程式跳转。 */

export function homePath(): string {
  return "/";
}

// ─── 模型 ────────────────────────────────────────────────────────────────

export function modelListPath(): string {
  return "/models/list";
}

export function modelAddPath(): string {
  return "/models/add";
}

export function modelEditPath(name: string): string {
  return `/models/${name}/edit`;
}

// ─── 记录 ────────────────────────────────────────────────────────────────

export function recordListPath(model: string): string {
  return `/records/${model}`;
}

export function recordAddPath(model: string): string {
  return `/records/${model}/add`;
}

export function recordEditPath(model: string, id: string): string {
  return `/records/${model}/edit/${id}`;
}

export function recordDetailPath(model: string, id: string): string {
  return `/records/${model}/detail/${id}`;
}
