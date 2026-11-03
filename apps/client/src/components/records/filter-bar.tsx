import { For, Show, createSignal } from "solid-js";
import type { Component } from "solid-js";
import { createFilterBinding, FormworkError } from "formwork";
import { normalizeClause } from "formwork/model";
import type {
  FilterBinding,
  ResolvedModel,
  RenderItemProps,
  QueryClause,
  QueryOperator,
} from "formwork";
import { Icon } from "../../formwork/shell/icons";
import { FilterItem } from "../fields/field-container";
import { SelectControl } from "../ui/select";
import { Message } from "../ui/message";

const labels: Record<QueryOperator, string> = {
  eq: "等于",
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  in: "属于任一",
  contains: "包含",
  between: "范围",
  isNull: "为空值",
  isNotNull: "非空值",
};
const maxConditions = 50;

/** 从一条条件开始按需组合字段、操作符和值，查询时提交所有已填写条件。 */
export const FilterBar: Component<{
  model: ResolvedModel;
  RenderItem: Component<RenderItemProps>;
  loading?: boolean;
  onQuery: (clauses: QueryClause[]) => void;
}> = (props) => {
  const fields = props.model.fields.filter(
    (field) => field.capabilities?.filter.length && field.schema.ui?.filter !== false,
  );
  const fieldOptions = fields.map((field) => ({
    value: field.path,
    label: field.schema.title ?? field.path.slice(1),
  }));
  const initialConditions = () => (fields[0] ? [createFilterBinding(fields[0])] : []);
  const [conditions, setConditions] = createSignal<FilterBinding[]>(initialConditions());
  const RenderItem = props.RenderItem;
  let conditionList: HTMLDivElement | undefined;

  const focusCondition = (index: number) => {
    queueMicrotask(() => {
      conditionList?.children[index]?.querySelector("button")?.focus();
    });
  };
  const submit = () => {
    try {
      const active = conditions().filter((binding) => binding.active());
      if (active.some((binding) => binding.errors().length))
        throw new FormworkError("INVALID_QUERY", "请检查筛选条件");
      props.onQuery(
        active.map((binding) =>
          normalizeClause(binding.path(), binding.operator(), binding.value()),
        ),
      );
    } catch (error) {
      Message.error(error);
      conditionList?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  };

  return (
    <Show when={fields.length}>
      <form
        class="panel filters"
        aria-label="筛选记录"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div
          class="filter-conditions"
          ref={(element) => {
            conditionList = element;
          }}
        >
          <For each={conditions()}>
            {(binding, index) => {
              const field = props.model.field(binding.path());
              const title = field.schema.title ?? field.path.slice(1);
              return (
                <div class="filter-row" role="group" aria-label={`条件 ${index() + 1}`}>
                  <SelectControl
                    class="filter-field"
                    label={`条件 ${index() + 1} 字段`}
                    options={fieldOptions}
                    value={field.path}
                    onChange={(path) => {
                      const next = fields.find((item) => item.path === path);
                      if (!next || path === field.path) return;
                      const position = index();
                      setConditions((current) =>
                        current.map((item) =>
                          item === binding ? createFilterBinding(next) : item,
                        ),
                      );
                      focusCondition(position);
                    }}
                  />
                  <SelectControl
                    class="filter-operator"
                    label={`条件 ${index() + 1} 运算符`}
                    options={field.capabilities!.filter.map((value) => ({
                      value,
                      label: labels[value],
                    }))}
                    value={binding.operator()}
                    onChange={(value) => {
                      if (!value || value === binding.operator()) return;
                      binding.setOperator(value as QueryOperator);
                      binding.setActive(!binding.operandSchema());
                    }}
                  />
                  <div class="filter-value">
                    <Show
                      when={binding.operandSchema()}
                      fallback={<span class="filter-no-value">无需填写值</span>}
                    >
                      <FilterItem
                        path={field.path}
                        title={`${title}筛选值`}
                        field={field}
                        scene="filter"
                        required={false}
                        errors={binding.errors()}
                      >
                        <RenderItem
                          field={field}
                          scene="filter"
                          binding={binding}
                          props={{ placeholder: field.props.placeholder ?? "输入值" }}
                          component={
                            ["gt", "gte", "lt", "lte", "between"].includes(binding.operator()) &&
                            (!field.schema.ui?.filter ||
                              !field.schema.ui.filter.component ||
                              field.schema.ui.filter.component === "Select")
                              ? "NumberInput"
                              : undefined
                          }
                        />
                      </FilterItem>
                    </Show>
                  </div>
                  <Show when={conditions().length > 1}>
                    <button
                      type="button"
                      class="icon-button filter-remove"
                      aria-label={`移除条件 ${index() + 1}`}
                      title="移除条件"
                      onClick={() => {
                        const position = index();
                        setConditions((current) => current.filter((item) => item !== binding));
                        focusCondition(Math.min(position, conditions().length - 1));
                      }}
                    >
                      <Icon name="close" />
                    </button>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
        <div class="actions filter-actions">
          <button
            type="button"
            class="button secondary filter-add"
            aria-label="添加条件"
            title={conditions().length >= maxConditions ? "最多添加 50 个条件" : "添加条件"}
            disabled={conditions().length >= maxConditions}
            onClick={() => {
              if (!fields[0] || conditions().length >= maxConditions) return;
              setConditions((current) => [...current, createFilterBinding(fields[0]!)]);
              focusCondition(conditions().length - 1);
            }}
          >
            <Icon name="plus" />
          </button>
          <button type="submit" class="button" disabled={props.loading}>
            查询
          </button>
          <button
            type="button"
            class="button secondary"
            onClick={() => {
              setConditions(initialConditions());
              props.onQuery([]);
            }}
          >
            重置
          </button>
        </div>
      </form>
    </Show>
  );
};
