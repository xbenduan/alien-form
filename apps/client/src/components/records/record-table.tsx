import { For, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import type { ResolvedModel, RenderItemProps, RecordValue, RecordQuery } from "formwork";
import { readPointer } from "formwork/model";
import { Icon } from "../../formwork/shell/icons";

/** 复用模型字段描述渲染整页记录，单元格直接接收值，不创建或校验 scope。 */
export const RecordTable: Component<{
  model: ResolvedModel;
  RenderItem: Component<RenderItemProps>;
  records: readonly RecordValue[];
  loading?: boolean;
  sort?: RecordQuery["sort"];
  onSort: (sort: RecordQuery["sort"]) => void;
  actions?: (record: RecordValue) => JSX.Element;
}> = (props) => {
  const columns = props.model.fields.filter(
    (field) => field.capabilities?.read !== false && field.schema.ui?.table !== false,
  );
  const RenderItem = props.RenderItem;
  return (
    <div
      class="table-scroll"
      tabindex="0"
      aria-label="记录表格，可横向滚动"
      aria-busy={props.loading}
    >
      <table aria-label={`${props.model.schema.title}记录`}>
        <thead>
          <tr>
            <For each={columns}>
              {(field) => (
                <th
                  classList={{
                    "numeric-cell":
                      field.schema.type === "number" || field.schema.type === "integer",
                  }}
                  aria-sort={
                    props.sort?.field === field.path
                      ? props.sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <Show
                    when={field.capabilities?.sort}
                    fallback={field.schema.title ?? field.path.slice(1)}
                  >
                    <button
                      class="text-button"
                      onClick={() => {
                        const current = props.sort;
                        props.onSort(
                          current?.field === field.path && current.direction === "desc"
                            ? undefined
                            : {
                                field: field.path,
                                direction: current?.field === field.path ? "desc" : "asc",
                              },
                        );
                      }}
                    >
                      {field.schema.title ?? field.path.slice(1)}
                      <Icon
                        name={
                          props.sort?.field === field.path
                            ? props.sort.direction === "asc"
                              ? "sort-asc"
                              : "sort-desc"
                            : "sort"
                        }
                      />
                    </button>
                  </Show>
                </th>
              )}
            </For>
            <Show when={props.actions}>
              <th class="operation-cell">操作</th>
            </Show>
          </tr>
        </thead>
        <tbody>
          <For each={props.records}>
            {(record) => (
              <tr data-record-id={String(record.id)}>
                <For each={columns}>
                  {(field) => (
                    <td
                      classList={{
                        "numeric-cell":
                          field.schema.type === "number" || field.schema.type === "integer",
                      }}
                    >
                      <RenderItem
                        field={field}
                        scene="table"
                        record={record}
                        value={readPointer(record, field.path) as RecordValue[string] | undefined}
                      />
                    </td>
                  )}
                </For>
                <Show when={props.actions}>
                  <td class="operation-cell">{props.actions?.(record)}</td>
                </Show>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
