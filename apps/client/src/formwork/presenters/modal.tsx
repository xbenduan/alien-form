import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { Modal } from "../../components/ui/window";

/** 在应用挂载边界内以弹窗展示记录操作。 */
export const ModalPresenter: Component<PresenterProps> = (props) => (
  <Modal
    open
    label={
      props.operation.mode === "detail"
        ? `${props.operation.model.schema.title}详情`
        : `${props.operation.mode === "create" ? "新建" : "编辑"}${props.operation.model.schema.title}`
    }
    onClose={() => void props.close()}
    portalTarget={props.portalTarget}
  >
    {props.children}
  </Modal>
);
