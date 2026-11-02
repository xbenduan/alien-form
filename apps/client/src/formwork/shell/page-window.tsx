import { createContext, createEffect, createSignal, onCleanup, Show, useContext } from "solid-js";
import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { Icon } from "./icons";
import { PageTopbar } from "./page-topbar";

const PageWindowTitle = createContext<(title: string | undefined) => void>();

/** 将完整页面 Window 的返回操作放入顶栏，并用公共面板承载内容。 */
export const PageWindow: Component<PresenterProps> = (props) => {
  const [title, setTitle] = createSignal<string>();
  const fallbackTitle = () =>
    props.window === "detail" ? "记录详情" : props.window === "add" ? "新建记录" : "编辑记录";
  return (
    <PageWindowTitle.Provider value={(value) => setTitle(value)}>
      <div class="record-page">
        <PageTopbar
          title={<h1 tabindex="-1">{title() ?? fallbackTitle()}</h1>}
          actions={
            <button type="button" class="button secondary" onClick={props.close}>
              <Icon name="arrow" class="ui-icon back-arrow" />
              返回列表
            </button>
          }
        />
        <section class="panel record-page-panel">{props.children}</section>
      </div>
    </PageWindowTitle.Provider>
  );
};

/** 在页面中同步顶栏标题，在 Modal 与 Drawer 中保留紧凑窗口标题。 */
export const RecordHeading: Component<{ title: string; section: string; readOnly?: boolean }> = (
  props,
) => {
  const pageTitle = useContext(PageWindowTitle);
  if (pageTitle) {
    createEffect(() => pageTitle(props.title));
    onCleanup(() => pageTitle(undefined));
  }
  return (
    <Show
      when={pageTitle}
      fallback={
        <div class="record-heading">
          <h1 tabindex="-1">{props.title}</h1>
        </div>
      }
    >
      <div class="panel-heading record-section-heading">
        <h2>
          <Icon name="content" />
          {props.section}
        </h2>
        <Show when={props.readOnly}>
          <span class="page-meta">只读</span>
        </Show>
      </div>
    </Show>
  );
};
