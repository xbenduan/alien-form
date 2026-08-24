import type { ReactNode } from "react";
import type { AfUiNode, PageContext } from "./describe";
import { RuntimeCore } from "./RuntimeCore";

export interface RenderNodeProps {
  node: AfUiNode;
  ctx: PageContext;
}

export function RenderNode({ node, ctx }: RenderNodeProps): ReactNode {
  const describe = RuntimeCore.current.ui.query(node.component, ctx.model);
  if (!describe) {
    throw new Error(`[alien-cms] 未注册 UI 组件 "${node.component}"（domain=${ctx.model}）`);
  }
  const Component = describe.Component;
  return (
    <Component
      props={node.props ?? {}}
      children={node.children ?? []}
      slots={node.slots ?? {}}
      ctx={ctx}
    />
  );
}

export function RenderChildren({
  children,
  ctx,
}: {
  children: AfUiNode[];
  ctx: PageContext;
}): ReactNode {
  return children.map((child, index) => (
    <RenderNode key={`${child.component}-${index}`} node={child} ctx={ctx} />
  ));
}
