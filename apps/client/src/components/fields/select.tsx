import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { Component } from "solid-js";
import type { EnumOption, FieldProps } from "formwork";
import { schemaType } from "formwork/model";
import { ChoiceControl } from "../ui/choice-control";
import { TagList } from "../ui/tag-list";
import { useRelationOptions } from "./relation-options";
import { useFieldLabel } from "./field-container";
import { EmptyValue, valueText } from "./display";
import { ErrorMessage } from "../ui/message";

type Atom = EnumOption["value"];
const atom = (value: unknown): value is Atom =>
  value === null || ["string", "number", "boolean"].includes(typeof value);
const key = (value: Atom) => JSON.stringify(value);

/** 在各场景共享枚举和关系，多选保持原始类型、顺序与完整数据。 */
export const Select: Component<
  FieldProps & {
    placeholder?: string;
    maxTagCount?: number;
    clearable?: boolean;
  }
> = (props) => {
  const service = useRelationOptions();
  const [search, setSearch] = createSignal("");
  const [opened, setOpened] = createSignal(false);
  const [remote, setRemote] = createSignal<EnumOption[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  const [attempt, setAttempt] = createSignal(0);
  const values = (): Atom[] =>
    Array.isArray(props.value)
      ? props.value.filter(atom)
      : props.value !== undefined && atom(props.value)
        ? [props.value]
        : [];
  const valueType = () => {
    const schema = props.operandSchema ?? props.schema;
    return schemaType("items" in schema ? schema.items : schema);
  };
  const options = (): readonly EnumOption[] =>
    props.relation
      ? remote()
      : props.options.length
        ? props.options.filter((option) => !props.multiple || option.value !== null)
        : valueType() === "boolean"
          ? [
              { value: true, label: "是" },
              { value: false, label: "否" },
            ]
          : [];
  const label = (value: Atom) =>
    (props.relation && value !== null ? service?.label(props.field, value) : undefined) ??
    options().find((item) => item.value === value)?.label ??
    valueText(value);
  createEffect(() => {
    if (props.relation)
      service?.ensure(
        props.field,
        values().filter((value) => value !== null),
      );
  });
  createEffect(() => {
    if (!props.relation || !opened() || props.readOnly) return;
    attempt();
    const keyword = search();
    const request = new AbortController();
    setLoading(true);
    setFailure("");
    const timer = setTimeout(() => {
      if (!service) {
        setFailure("关系服务未挂载");
        setLoading(false);
        return;
      }
      void service
        .search(props.field, keyword, request.signal)
        .then((result) => {
          if (!request.signal.aborted) setRemote(result);
        })
        .catch((error) => {
          if (!request.signal.aborted)
            setFailure(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          if (!request.signal.aborted) setLoading(false);
        });
    }, 150);
    onCleanup(() => {
      clearTimeout(timer);
      request.abort();
    });
  });
  const visible = () =>
    options()
      .filter(
        (item) =>
          props.relation || item.label.toLocaleLowerCase().includes(search().toLocaleLowerCase()),
      )
      .map((item) => ({ key: key(item.value), label: item.label }));
  const candidate = (): Atom | undefined => {
    if (props.relation || props.options.length || !props.multiple) return;
    if (valueType() === "string") return search();
    if (["number", "integer"].includes(valueType()) && search().trim()) {
      const number = Number(search());
      if (Number.isFinite(number) && (valueType() !== "integer" || Number.isInteger(number)))
        return number;
    }
    return;
  };
  const choose = (value: Atom) => {
    if (!props.multiple) {
      props.onChange(value);
      return;
    }
    const current = values();
    props.onChange(
      current.some((item) => item === value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };
  return (
    <>
      <ErrorMessage
        error={failure() || service?.error(props.field)}
        retry={() => {
          service?.retry(props.field);
          setAttempt((value) => value + 1);
        }}
        retryLabel="重试标签"
      />
      <Show
        when={!props.readOnly}
        fallback={
          <span title={service?.error(props.field)}>
            <Show
              when={
                props.scene !== "detail" ||
                props.options.some((option) => option.value === props.value) ||
                (props.value !== undefined &&
                  props.value !== null &&
                  props.value !== "" &&
                  (!Array.isArray(props.value) || props.value.length > 0))
              }
              fallback={<EmptyValue value={props.value} />}
            >
              <Show
                when={Array.isArray(props.value)}
                fallback={
                  <span
                    class="value-badge"
                    classList={{
                      positive: props.scene === "detail" && props.value === true,
                      "detail-negative": props.scene === "detail" && props.value === false,
                    }}
                  >
                    <Show when={props.scene === "detail" && typeof props.value === "boolean"}>
                      <span class="status-dot" aria-hidden="true" />
                    </Show>
                    {props.value === undefined ? "—" : values().map(label).join("、")}
                  </span>
                }
              >
                <TagList
                  labels={values().map(label)}
                  maxTagCount={props.scene === "detail" ? values().length : props.maxTagCount}
                />
              </Show>
            </Show>
            <Show when={service?.error(props.field)}>
              <button type="button" class="text-button" onClick={() => service?.retry(props.field)}>
                重试标签
              </button>
            </Show>
          </span>
        }
      >
        <ChoiceControl
          options={visible()}
          selected={values().map((value) => ({ key: key(value), label: label(value) }))}
          multiple={props.multiple}
          placeholder={props.placeholder}
          labelledBy={useFieldLabel()}
          disabled={props.disabled}
          invalid={props.errors.length > 0}
          clearable={props.clearable ?? true}
          loading={loading()}
          search={search()}
          onSearch={setSearch}
          onOpen={() => setOpened(true)}
          onChoose={(selected) => choose(JSON.parse(selected) as Atom)}
          onClear={() => props.onChange(undefined)}
          onCreate={
            candidate() !== undefined && !values().includes(candidate()!)
              ? () => {
                  choose(candidate()!);
                  setSearch("");
                }
              : undefined
          }
        />
        <Show when={failure() || service?.error(props.field)}>
          <button
            type="button"
            class="text-button"
            onClick={() => {
              service?.retry(props.field);
              setAttempt((value) => value + 1);
            }}
          >
            重试
          </button>
        </Show>
      </Show>
    </>
  );
};
