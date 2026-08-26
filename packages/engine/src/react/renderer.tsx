import React from "react";
import type { UiNode } from "../core/dsl";
import { BlockProvider, usePage, useRuntime, NodeContext } from "./context";
import type { ComponentDescriptor } from "../core/registry";

export interface ComponentProps {
  node: UiNode;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function RenderNode({
  node,
  props,
}: {
  node: UiNode;
  /** 渲染时注入/覆盖节点 props（如把当前行 record 传给行操作子节点）。 */
  props?: Record<string, unknown>;
}): React.ReactNode {
  const runtime = useRuntime();
  const page = usePage();

  // 组件解析支持 per-model 覆盖：优先取 PageSchema.domain 注册的组件，
  // 未命中回退 global。这让 register/{model}/index.ts 能覆盖特定模型的 UI 组件。
  const descriptor = runtime.registry.components.resolve(node.component, page.domain) as
    | ComponentDescriptor<React.ComponentType<ComponentProps>>
    | undefined;

  if (!descriptor) {
    throw new Error(
      `[alien-page] component "${node.component}" not registered (page="${page.id}")`,
    );
  }

  const Component = descriptor.component;
  const block = node.block ? page.block(node.block) : undefined;

  const children = node.children?.map((child, i) => (
    <RenderNode key={`${child.component}-${i}`} node={child} />
  ));

  const slots: Record<string, React.ReactNode> = {};
  if (node.slots) {
    for (const [slotName, slotNodes] of Object.entries(node.slots)) {
      slots[slotName] = slotNodes.map((child, i) => (
        <RenderNode key={`${child.component}-${i}`} node={child} />
      ));
    }
  }

  const element = (
    <Component {...(node.props ?? {})} {...props} node={node}>
      {children}
    </Component>
  );

  const wrapped = (
    <NodeContext.Provider value={{ slots: node.slots }}>
      {element}
    </NodeContext.Provider>
  );

  if (block) {
    return <BlockProvider block={block}>{wrapped}</BlockProvider>;
  }
  return wrapped;
}

export function RenderChildren({ children }: { children: UiNode[] }): React.ReactNode {
  return children.map((child, i) => (
    <RenderNode key={`${child.component}-${i}`} node={child} />
  ));
}

export function Slot({
  name,
  children,
}: {
  name: string;
  children?: React.ReactNode;
}) {
  const nodeCtx = React.useContext(NodeContext);
  const slotNodes = (nodeCtx?.slots as Record<string, UiNode[]> | undefined)?.[name];
  if (!slotNodes) return <>{children}</>;
  return (
    <>
      {slotNodes.map((node, i) => (
        <RenderNode key={`${node.component}-${i}`} node={node} />
      ))}
    </>
  );
}
