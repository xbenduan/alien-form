import type { Runtime, UiNode } from "@alien-form/engine";
import type { UiComponentDefinition, UiPropsConfig } from "@app-types/shared";

/** 构建并直接注册一个布局（ui）组件。 */
export function registerUiComponent(
  runtime: Runtime,
  code: string,
  title: string,
  kind: UiComponentDefinition["authoring"]["kind"],
  component: UiComponentDefinition["component"],
  options: {
    description?: string;
    parent?: string;
    children: boolean;
    props: UiPropsConfig;
    slots?: string[];
    defaults?: UiNode;
  },
): void {
  const definition: UiComponentDefinition = {
    code,
    title,
    description: options.description,
    component,
    slots: options.slots,
    authoring: {
      kind,
      parent: options.parent,
      children: options.children,
      props: options.props,
      create: () => structuredClone(options.defaults ?? { component: code }),
    },
  };
  runtime.ui(definition);
}
