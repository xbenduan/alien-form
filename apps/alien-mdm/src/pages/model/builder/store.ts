import { useCallback, useMemo, useReducer } from "react";
import type { Runtime } from "@alien-form/engine";
import { createId } from "./codec";
import { reduceModel, type ModelAction } from "./commands";
import type { FieldNode, ModelDraft } from "./types";

/** 深拷贝一个字段子树并重建 id（用于复制）。 */
export function cloneFieldTree(node: FieldNode, keySuffix = "_copy"): FieldNode {
  return {
    ...node,
    id: createId(),
    key: `${node.key}${keySuffix}`,
    storage: node.storage ? { ...node.storage } : undefined,
    form: { ...node.form, props: node.form.props ? { ...node.form.props } : undefined },
    children: node.children?.map((child) => cloneFieldTree(child, "")),
  };
}

export interface ModelBuilderStore {
  draft: ModelDraft;
  dispatch: (action: ModelAction) => void;
  runtime: Runtime;
  domain: string;
}

export function useModelBuilderStore(initial: ModelDraft, runtime: Runtime): ModelBuilderStore {
  const [draft, dispatch] = useReducer(reduceModel, initial);
  const dispatchAction = useCallback((action: ModelAction) => dispatch(action), []);
  return useMemo(
    () => ({ draft, dispatch: dispatchAction, runtime, domain: draft.name }),
    [draft, dispatchAction, runtime],
  );
}
