import type { Runtime } from "@alien-form/engine";
import { RecordPage } from "./record-page";
import { RecordOverlay } from "./overlay";
import { RecordActionPageLayout } from "./action-page";
import { BuilderPreview } from "./builder-preview";

/**
 * 页面级节点：整页壳（record-page）、叠加层（overlay）、整页动作（action-page）。
 * 与 ui 目录的布局/交互组件区分——这里注册的是页面级容器。
 */
export function registerPageComponents(runtime: Runtime): void {
  runtime.ui({
    code: "record-page",
    title: "记录页面",
    description: "记录列表和操作页面的统一页面外壳。",
    component: RecordPage,
    authoring: {},
  });
  runtime.ui({
    code: "overlay",
    title: "记录浮层",
    description: "承载新增、详情和编辑表单的浮层。",
    component: RecordOverlay,
    authoring: {},
  });
  runtime.ui({
    code: "action-page",
    title: "记录操作页",
    description: "整页新增、详情和编辑布局。",
    component: RecordActionPageLayout,
    authoring: {},
  });
  runtime.ui({
    code: "builder-preview",
    title: "构建预览",
    description: "在模型构建器中渲染表单预览。",
    component: BuilderPreview,
    authoring: {},
  });
}
