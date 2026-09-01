import type { Runtime } from "@engine";

export function registerEnums(runtime: Runtime): void {
  runtime.constant("status", [
    { label: "启用", value: "active" },
    { label: "停用", value: "inactive" },
  ]);
  runtime.constant("fieldTypes", [
    { label: "文本", value: "string" },
    { label: "数字", value: "number" },
    { label: "布尔", value: "boolean" },
    { label: "对象", value: "object" },
    { label: "数组", value: "array" },
  ]);
}
