import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { FieldContainerProps } from "formwork";
import { Icon } from "../../formwork/shell/icons";
import { FieldsetCard } from "../../formwork/shell/fieldset-card";

/** 用键值描述和带标题的内容分组呈现只读字段，不展示表单必填与编辑控件。 */
export const DetailItem: Component<FieldContainerProps & { labelId: string }> = (props) => {
  const grouped = () => ["object", "array"].includes(props.field?.format ?? "");
  const audit = () => ["/createdAt", "/updatedAt", "/creatorId"].includes(props.path);
  return (
    <Show
      when={grouped()}
      fallback={
        <dl
          class="form-item detail-property"
          classList={{ "detail-audit": audit() }}
          data-field-path={props.path}
        >
          <dt id={props.labelId} class="field-label">
            {props.title}
          </dt>
          <dd>{props.children}</dd>
          <Show when={props.field?.props.help}>
            <dd class="detail-help">{String(props.field?.props.help)}</dd>
          </Show>
        </dl>
      }
    >
      <FieldsetCard
        fieldPath={props.path}
        labelId={props.labelId}
        title={
          <span class="detail-group-title">
            <Icon name={props.field?.format === "array" ? "layers" : "grid"} />
            <span>{props.title}</span>
          </span>
        }
      >
        {props.children}
      </FieldsetCard>
    </Show>
  );
};
