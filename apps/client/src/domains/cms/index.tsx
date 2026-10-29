import { defineDomain } from "formwork";
import type { ActionContext, FieldProps, JsonValue } from "formwork";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { defaultComponent, escapePointer, isObject } from "formwork/model";
import { saveRecord } from "../../fn/records";
import { cmsDocumentSchema } from "./model.schema";
import { useFieldLabel } from "../../ui/field-container";

/** 编辑 cms 正文，以字符串保存，并在详情中呈现保留换行的文本。 */
export const RichText: Component<FieldProps> = (props) => (
  <Show when={!props.readOnly} fallback={<div class="rich-text">{String(props.value ?? "")}</div>}>
    <textarea
      class="control rich-editor"
      aria-labelledby={useFieldLabel()}
      value={String(props.value ?? "")}
      disabled={props.disabled}
      onInput={(event) => props.onChange(event.currentTarget.value)}
    />
  </Show>
);

/** 保存 cms 内容时去除标题首尾空白，其余字段保持完整。 */
export function saveCmsRecord(ctx: ActionContext, value: JsonValue | undefined) {
  return saveRecord(
    ctx,
    isObject(value) && typeof value.title === "string"
      ? ({ ...value, title: value.title.trim() } as JsonValue)
      : value,
  );
}

/** 为 cms 注入正文编辑、标题归一化和就近模型校验。 */
export default defineDomain({
  components: { RichText },
  fn: { saveRecord: saveCmsRecord },
  schema: cmsDocumentSchema,
  getSchema: (ctx) => ({
    ...ctx.schema,
    views: {
      ...ctx.schema.views,
      add: {
        component: "Object",
        field: "",
        children: Object.entries(ctx.schema.data.properties).map(([name, schema]) => ({
          component: name === "content" ? "RichText" : defaultComponent(schema, ctx.schema.data),
          field: `/${escapePointer(name)}`,
        })),
      },
    },
  }),
});
