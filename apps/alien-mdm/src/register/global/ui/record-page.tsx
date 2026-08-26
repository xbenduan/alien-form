import { usePage, type ComponentProps } from "@alien-form/engine/react";
import { PageBreadcrumb } from "../../../components";
import { recordListPath } from "../../../app/router/paths";
import type { ModelPageScene } from "../../../compiler/model-to-page";
import styles from "../ui.module.css";

const ACTION_TITLE: Record<Exclude<ModelPageScene, "list">, string> = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
};

/**
 * 记录页面壳由 runtime layout 驱动，统一承接 breadcrumb、页面宽度和动作页样式。
 * 路由层只传 model/scene，不再手写任何页面 UI。
 */
export function RecordPage({ children }: ComponentProps) {
  const page = usePage();
  const meta = page.schema.meta ?? {};
  const scene = (meta.scene as ModelPageScene | undefined) ?? "list";
  const model = (meta.model as string | undefined) ?? page.domain;
  const title = (meta.title as string | undefined) ?? page.schema.title ?? model;
  const singularLabel = (meta.singularLabel as string | undefined) ?? title;
  const isAction = scene !== "list";

  const items = isAction
    ? [
        { title: `${singularLabel}列表`, to: recordListPath(model) },
        { title: `${ACTION_TITLE[scene]}${singularLabel}` },
      ]
    : [{ title }];

  return (
    <div className={`${styles.recordRoute}${isAction ? ` ${styles.actionRoute}` : ""}`}>
      <PageBreadcrumb items={items} />
      {children as React.ReactNode}
    </div>
  );
}
