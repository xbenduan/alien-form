import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { Drawer } from "../../components/ui/window";

/** 在应用挂载边界内以抽屉展示记录操作。 */
export const DrawerPresenter: Component<PresenterProps> = (props) => (
  <Drawer
    open
    label={props.operation.mode === "detail" ? "记录详情" : "编辑记录"}
    onClose={() => void props.close()}
    portalTarget={props.portalTarget}
  >
    {props.children}
  </Drawer>
);
