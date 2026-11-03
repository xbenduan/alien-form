import { For, Show, createSignal } from "solid-js";
import type { Component } from "solid-js";
import { createQueryState } from "formwork";
import type { ResolvedModel, RenderItemProps, QueryClause, QueryOperator } from "formwork";
import { FilterItem } from "../fields/field-container";
import { SelectControl } from "../ui/select";

const labels: Record<QueryOperator, string> = {
  eq: "等于",
  in: "属于任一",
  contains: "包含",
  between: "范围",
  isNull: "为空值",
  isNotNull: "非空值",
};

/** 展示后端支持的全部筛选字段，并提交独立于记录默认值的 QueryClause。 */
export const FilterBar: Component<{
  model: ResolvedModel;
  RenderItem: Component<RenderItemProps>;
  loading?: boolean;
  onQuery: (clauses: QueryClause[]) => void;
}> = (props) => {
  const query = createQueryState(props.model);
  const RenderItem = props.RenderItem;
  const [failure, setFailure] = createSignal("");
  return (
    <form
      class="panel filters filters-expanded"
      aria-label="筛选记录"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          props.onQuery(query.clauses());
          setFailure("");
        } catch (error) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      }}
    >
      <For
        each={query.fields.filter(
          (binding) => props.model.field(binding.path()).schema.ui?.filter !== false,
        )}
      >
        {(binding) => {
          const field = props.model.field(binding.path());
          return (
            <FilterItem
              path={field.path}
              title={field.schema.title ?? field.path.slice(1)}
              field={field}
              scene="filter"
              required={false}
              errors={binding.errors()}
            >
              <div class="filter-condition">
                <label class="filter-enable">
                  <input
                    type="checkbox"
                    checked={binding.active()}
                    onChange={(event) => binding.setActive(event.currentTarget.checked)}
                  />
                  启用
                </label>
                <SelectControl
                  label={`${field.schema.title ?? field.path}筛选方式`}
                  options={field.capabilities!.filter.map((value) => ({
                    value,
                    label: labels[value],
                  }))}
                  value={binding.operator()}
                  onChange={(value) => {
                    if (value) binding.setOperator(value as QueryOperator);
                  }}
                />
              </div>
              <Show when={binding.operandSchema()}>
                <RenderItem
                  field={field}
                  scene="filter"
                  binding={binding}
                  component={
                    binding.operator() === "between" &&
                    !(field.schema.ui?.filter && field.schema.ui.filter.component)
                      ? "NumberInput"
                      : undefined
                  }
                />
              </Show>
            </FilterItem>
          );
        }}
      </For>
      <div class="actions filter-actions">
        <button
          type="button"
          class="button secondary"
          onClick={() => {
            query.reset();
            setFailure("");
            props.onQuery([]);
          }}
        >
          重置
        </button>
        <button type="submit" class="button" disabled={props.loading}>
          查询
        </button>
      </div>
      <Show when={failure()}>
        <p class="field-error" role="alert">
          {failure()}
        </p>
      </Show>
    </form>
  );
};
