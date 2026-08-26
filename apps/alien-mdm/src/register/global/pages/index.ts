import type { Runtime } from "@alien-form/engine";
import { RecordPage } from "./record-page";
import { RecordOverlay } from "./overlay";
import { RecordActionPageLayout } from "./action-page";

/**
 * 页面级节点：整页壳（record-page）、叠加层（overlay）、整页动作（action-page）。
 * 与 ui 目录的布局/交互组件区分——这里注册的是页面级容器。
 */
export function registerPageComponents(runtime: Runtime): void {
  runtime.component("record-page", { component: RecordPage });
  runtime.component("overlay", { component: RecordOverlay });
  runtime.component("action-page", { component: RecordActionPageLayout });
}
