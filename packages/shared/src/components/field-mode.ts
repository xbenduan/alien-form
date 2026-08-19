import { createContext, useContext } from "react";
import type { FieldMode } from "../types";

/**
 * 表单/详情模式下发：form 顶层注入 add|edit|detail，字段组件据此切换只读态。
 * table 单元格直接以 mode="detail" 显式传入，不依赖 context。
 */
const FieldModeContext = createContext<FieldMode>("edit");

export const FieldModeScope = FieldModeContext.Provider;

/** 优先使用显式 prop，其次回退到 context。 */
export function useFieldMode(mode?: FieldMode): FieldMode {
  const contextMode = useContext(FieldModeContext);
  return mode ?? contextMode;
}
