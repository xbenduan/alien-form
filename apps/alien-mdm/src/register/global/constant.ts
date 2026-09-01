import type { Runtime } from "@alien-form/engine";

export function registerConstant(runtime: Runtime): void {
  runtime.constant("overlayTitlePrefix", {
    add: "新建",
    edit: "编辑",
    detail: "详情",
  });
  runtime.constant("status", [
    { label: "正常", value: "normal" },
    { label: "停用", value: "disabled" },
  ]);
}
