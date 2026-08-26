import type { Runtime } from "@alien-form/engine";

export function registerConstant(runtime: Runtime): void {
  runtime.constant("overlayTitlePrefix", {
    add: "新建",
    edit: "编辑",
    detail: "详情",
  });
  runtime.constant("gender", [
    { label: "男", value: "male" },
    { label: "女", value: "female" },
    { label: "未知", value: "unknown" },
  ]);
  runtime.constant("grades", [
    { label: "一年级", value: "grade-1" },
    { label: "二年级", value: "grade-2" },
    { label: "三年级", value: "grade-3" },
    { label: "四年级", value: "grade-4" },
    { label: "五年级", value: "grade-5" },
    { label: "六年级", value: "grade-6" },
  ]);
  runtime.constant("status", [
    { label: "正常", value: "normal" },
    { label: "停用", value: "disabled" },
  ]);
}
