import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { Drawer } from "../shell/window";

/** 用抽屉承载完整 Window 内容，关闭和焦点恢复由 Host 管理。 */
export const DrawerPresenter: Component<PresenterProps> = (props) => (
  <Drawer open label={props.window === "detail" ? "记录详情" : "记录窗口"}
    onClose={props.close} restoreFocus={false}>{props.children}</Drawer>
);
