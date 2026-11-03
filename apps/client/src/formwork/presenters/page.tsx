import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { PageTopbar } from "../shell/page-topbar";
import { Icon } from "../shell/icons";

/** 承载记录直达页，返回操作同样经过未保存草稿守卫。 */
export const PagePresenter: Component<PresenterProps> = (props) => (
  <div class="record-page">
    <PageTopbar
      title={<h1>{props.operation.model.schema.title}</h1>}
      actions={
        <button class="button secondary" onClick={() => props.close()}>
          <Icon name="arrow" />
          返回列表
        </button>
      }
    />
    <section class="panel record-page-panel">{props.children}</section>
  </div>
);
