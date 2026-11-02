import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { Modal } from "../shell/window";

/** 用弹窗承载完整 Window 内容，关闭和焦点恢复由 Host 管理。 */
export const ModalPresenter: Component<PresenterProps> = (props) => (
  <Modal open label={props.window === "add" ? "新建记录" : "编辑记录"}
    onClose={props.close} restoreFocus={false}>{props.children}</Modal>
);
