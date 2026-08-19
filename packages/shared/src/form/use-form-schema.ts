import { useMemo } from "react";
import type { IFormSchema } from "@alien-form/react";
import type { SchemaConfig } from "../types";
import { buildFormSchema } from "../utils/transform";

/**
 * useFormSchema：把配置态 schema 转成 form 渲染 schema（分组 → x-layout void 容器）。
 * 记忆化，schema 引用不变则复用结果。
 */
export function useFormSchema(config: SchemaConfig): IFormSchema {
  return useMemo(() => buildFormSchema(config), [config]);
}
