import { ErrorBoundary, onCleanup, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createRecordList } from "../core/record-list";
import type { RecordListController, RecordListOptions } from "../core/record-list";
import type { OpenMode } from "../model/types";
import type { RecordSlots } from "../core/types";
import { component, ModelProvider, useRuntime } from "../core/context";
import { Feedback } from "../core/formwork";
import { Detail, Editor } from "./record";

type SharedProps = { controller: RecordListController; children?: JSX.Element };
/** 组合默认列表部件，或者借用 app 创建的共享 controller。 */
export type RecordsProps = RecordListOptions &
  RecordSlots & {
    controller?: RecordListController;
    presentation?: OpenMode;
  };
function piece(key: "filter" | "actions" | "table" | "pagination"): Component<SharedProps> {
  return (props) => {
    const runtime = useRuntime();
    return (
      <Dynamic
        component={component(runtime, runtime.app.ui.records?.[key])}
        controller={props.controller}
        children={props.children}
      />
    );
  };
}
/** 使用 app 的筛选界面更新共享列表条件。 */
export const Filters = piece("filter");
/** 将授权后的记录动作交给 app 展示。 */
export const RecordActions = piece("actions");
/** 将当前查询页和字段 renderer 交给 app 表格，children 承载状态和分页。 */
export const RecordsTable = piece("table");
/** 使用 app 的分页界面控制同一查询。 */
export const Pagination = piece("pagination");
/** 为一个列表注册唯一操作出口，独立于列表数据的加载边界。 */
export type RecordOutletProps = SharedProps & RecordSlots & { presentation?: OpenMode };
/** 还原直达或本地操作，在每次激活时调用相应 slot 并销毁上一次内容。 */
export const RecordOutlet: Component<RecordOutletProps> = (props) => {
  const runtime = useRuntime();
  const Mounted: Component = () => {
    const release = props.controller.registerOutlet(
      {
        detail: props.detail,
        create: props.create,
        edit: props.edit,
      },
      props.presentation,
    );
    onCleanup(release);
    return (
      <Show when={props.controller.operation()} keyed>
        {(operation) => {
          const Content: Component = () => {
            if (operation.mode === "detail")
              return typeof props.detail === "function" ? (
                props.detail({ ...operation, recordId: operation.recordId! })
              ) : (
                <Detail operation={operation} />
              );
            const slot = operation.mode === "create" ? props.create : props.edit;
            return typeof slot === "function" ? (
              slot({ ...operation, recordId: operation.recordId! })
            ) : (
              <Editor operation={operation} />
            );
          };
          return (
            <Dynamic
              component={component(runtime, runtime.app.ui.presenters?.[operation.presentation])}
              operation={operation}
              close={operation.close}
              direct={operation.direct}
              portalTarget={runtime.portalTarget()}
            >
              <ErrorBoundary
                fallback={(error, retry) => <Feedback kind="error" error={error} retry={retry} />}
              >
                <ModelProvider.Provider value={operation.model}>
                  <Content />
                </ModelProvider.Provider>
              </ErrorBoundary>
            </Dynamic>
          );
        }}
      </Show>
    );
  };
  return (
    <Show when={props.controller.model()} keyed>
      {(_model) => <Mounted />}
    </Show>
  );
};
/** 默认组合列表动作、筛选、表格、分页及详情/编辑出口，视觉完全由 app.ui 决定。 */
export const Records: Component<RecordsProps> = (props) => {
  const runtime = useRuntime();
  const controller = props.controller ?? createRecordList(() => props);
  const Content: Component = () => (
    <>
      <RecordActions controller={controller} />
      <Filters controller={controller} />
      <Show when={controller.error()}>
        {(error) => <Feedback kind="error" error={error()} retry={controller.refresh} />}
      </Show>
      <RecordsTable controller={controller}>
        <Show when={controller.loading()}>
          <Feedback kind="loading" />
        </Show>
        <Show when={!controller.loading() && !controller.error() && !controller.items().length}>
          <Feedback kind="empty" />
        </Show>
        <Pagination controller={controller} />
      </RecordsTable>
    </>
  );
  return (
    <>
      <Show when={controller.model()} fallback={<Feedback kind="loading" />}>
        <Show when={runtime.app.ui.records?.layout} fallback={<Content />}>
          {(layout) => (
            <Dynamic component={component(runtime, layout())} controller={controller}>
              <Content />
            </Dynamic>
          )}
        </Show>
      </Show>
      <RecordOutlet {...props} controller={controller} />
    </>
  );
};
