import { For, Show } from "solid-js";
import type { Component } from "solid-js";
import type { ResolvedModel, RenderItemProps, ValueScope, Scene } from "formwork";
import { FormItem } from "../fields/field-container";

/** 按字段顺序编排记录表单或详情，权限与 scene 独立传入 renderer。 */
export const RecordForm: Component<{
  model: ResolvedModel;
  RenderItem: Component<RenderItemProps>;
  scope: ValueScope;
  editing?: boolean;
  scene?: Extract<Scene, "form" | "detail">;
}> = (props) => {
  const RenderItem = props.RenderItem;
  const scene = () => props.scene ?? "form";
  return (
    <For
      each={props.model.fields.filter(
        (field) => field.capabilities?.read !== false && field.schema.ui?.[scene()] !== false,
      )}
    >
      {(field) => {
        const binding = props.scope.field(field.path);
        const readOnly = () =>
          scene() === "detail" ||
          binding.readOnly() ||
          (props.editing
            ? field.capabilities?.update === false
            : field.capabilities?.create === false);
        return (
          <FormItem
            path={field.path}
            field={field}
            scene={scene()}
            schema={field.valueSchema}
            title={field.schema.title ?? field.path.slice(1)}
            required={scene() === "form" && !!field.schema.required}
            errors={binding.errors()}
          >
            <RenderItem field={field} scene={scene()} binding={binding} readOnly={readOnly()} />
            <Show when={!readOnly()}>
              <div class="field-value-actions">
                <Show when={!field.schema.required && binding.value() !== undefined}>
                  <button type="button" class="text-button" onClick={() => binding.set(undefined)}>
                    删除字段值
                  </button>
                </Show>
                <Show when={field.schema.nullable && binding.value() !== null}>
                  <button type="button" class="text-button" onClick={() => binding.set(null)}>
                    设为 null
                  </button>
                </Show>
              </div>
            </Show>
          </FormItem>
        );
      }}
    </For>
  );
};
