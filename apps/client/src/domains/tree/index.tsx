import { For } from "solid-js";
import { ErrorMessage } from "../../components/ui/message";
import { defineDomain } from "formwork";
import { readPointer } from "formwork/model";
import { createRecordList, Detail, Pagination, RecordActions, RecordOutlet } from "formwork/atom";

/** 演示自定义树形行布局；仅按当前查询页分组，不声明完整树查询能力。 */
export default defineDomain({
  router: "tree-list",
  render: (ctx) => {
    const list = createRecordList();
    const groups = () => [
      ...new Set(
        list
          .items()
          .map((record) =>
            ctx.schema.tree
              ? String(readPointer(record.data, ctx.schema.tree.parentField) ?? "根节点")
              : "记录",
          ),
      ),
    ];
    return (
      <div class="list-page">
        <RecordActions controller={list} />
        <p class="muted">树形布局示例 · 按当前页的父节点分组</p>
        <ErrorMessage error={list.error()} retry={list.refresh} />
        <For each={groups()}>
          {(parent) => (
            <details class="panel" open>
              <summary>{parent}</summary>
              <ul>
                <For
                  each={list
                    .items()
                    .filter(
                      (record) =>
                        (ctx.schema.tree
                          ? String(
                              readPointer(record.data, ctx.schema.tree.parentField) ?? "根节点",
                            )
                          : "记录") === parent,
                    )}
                >
                  {(record) => (
                    <li>
                      <button
                        class="text-button"
                        onClick={() => list.openDetail(record.id, "drawer")}
                      >
                        {String(record.data.name ?? record.data.title ?? record.id)}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </details>
          )}
        </For>
        <Pagination controller={list} />
        <RecordOutlet
          controller={list}
          presentation="drawer"
          detail={(operation) => <Detail operation={operation} />}
        />
      </div>
    );
  },
});
