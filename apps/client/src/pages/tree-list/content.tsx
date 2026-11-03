import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { FormworkError } from "formwork";
import type { PageContext, RecordValue } from "formwork";
import { pointerSegments } from "formwork/model";
import { RecordList } from "../../formwork/data/record-list";

type TreeNode = { id: string; label: string; children: TreeNode[] };
function buildTree(records: RecordValue[], parentField: string, labelField: string): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const record of records) {
    if (typeof record.id !== "string" || !record.id || nodes.has(record.id))
      throw new FormworkError("INVALID_RECORD", "树记录 id 缺失或重复");
    nodes.set(record.id, {
      id: record.id,
      label: String(record[labelField] ?? record.id),
      children: [],
    });
  }
  const parents = new Map(records.map((record) => [record.id as string, record[parentField]]));
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const visited = new Set([node.id]);
    let parentId = parents.get(node.id);
    while (typeof parentId === "string" && nodes.has(parentId)) {
      if (visited.has(parentId)) throw new FormworkError("INVALID_RECORD", "父级关系存在循环");
      visited.add(parentId);
      parentId = parents.get(parentId);
    }
    const parent = parents.get(node.id);
    if (typeof parent === "string" && nodes.has(parent)) nodes.get(parent)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** 以授权记录构建左侧层级，选中节点后复用 List 查询其直系子级。 */
export const TreeList: Component<PageContext> = (ctx) => {
  if (!ctx.schema.tree)
    throw new FormworkError("INVALID_MODEL", "tree-list 需要 tree.parentField 和 tree.labelField");
  const parentField = pointerSegments(ctx.schema.tree.parentField)[0]!;
  const labelField = pointerSegments(ctx.schema.tree.labelField)[0]!;
  const [records, { refetch }] = createResource(
    () => ctx.fn.loadTreeRecords() as Promise<RecordValue[]>,
  );
  const [selected, setSelected] = createSignal<string>();
  const tree = createMemo(() => {
    if (records.error) return { nodes: [] as TreeNode[], error: "" };
    try {
      return { nodes: buildTree(records() ?? [], parentField, labelField), error: "" };
    } catch (error) {
      return {
        nodes: [] as TreeNode[],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  createEffect(() => {
    if (records.error) return;
    const rows = records();
    if (rows)
      setSelected((current) =>
        current && !rows.some((record) => record.id === current) ? undefined : current,
      );
  });
  const Branch: Component<{ nodes: TreeNode[] }> = (props) => (
    <ul class="record-tree">
      <For each={props.nodes}>
        {(node) => (
          <li>
            <Show
              when={node.children.length}
              fallback={
                <button
                  class="tree-node"
                  classList={{ selected: selected() === node.id }}
                  aria-pressed={selected() === node.id}
                  onClick={() => setSelected(node.id)}
                >
                  {node.label}
                </button>
              }
            >
              <details open>
                <summary>
                  <button
                    class="tree-node"
                    classList={{ selected: selected() === node.id }}
                    aria-pressed={selected() === node.id}
                    onClick={() => setSelected(node.id)}
                  >
                    {node.label}
                  </button>
                </summary>
                <Branch nodes={node.children} />
              </details>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
  return (
    <div class="tree-list-page">
      <aside class="panel tree-panel" aria-label={`${ctx.schema.title}层级`}>
        <div class="data-heading">
          <h2>记录层级</h2>
          <button class="text-button" disabled={records.loading} onClick={() => refetch()}>
            刷新
          </button>
        </div>
        <button
          class="tree-node"
          classList={{ selected: !selected() }}
          aria-pressed={!selected()}
          onClick={() => setSelected(undefined)}
        >
          全部记录
        </button>
        <Show when={records.loading}>
          <p role="status">正在加载层级…</p>
        </Show>
        <Show when={records.error || tree().error}>
          <p role="alert">{String(records.error || tree().error)}</p>
        </Show>
        <Branch nodes={tree().nodes} />
        <Show
          when={!records.loading && !records.error && !tree().error && tree().nodes.length === 0}
        >
          <p class="muted">暂无层级记录</p>
        </Show>
      </aside>
      <RecordList
        ctx={ctx}
        parentId={selected()}
        onRecordsChanged={() => {
          void refetch();
        }}
      />
    </div>
  );
};
