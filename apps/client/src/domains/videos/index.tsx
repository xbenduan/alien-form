import { For } from "solid-js";
import { ErrorMessage } from "../../components/ui/message";
import { defineDomain } from "formwork";
import { createRecordList, Detail, Pagination, RecordActions, RecordOutlet } from "formwork/atom";

/** 演示卡片列表复用记录查询和默认详情，不要求媒体播放器或专属模型。 */
export default defineDomain({
  router: "videos",
  render: () => {
    const list = createRecordList();
    return (
      <div class="list-page">
        <RecordActions controller={list} />
        <p class="muted">视频卡片布局示例</p>
        <ErrorMessage error={list.error()} retry={list.refresh} />
        <div class="example-cards">
          <For each={list.items()}>
            {(record) => (
              <article class="panel">
                <h2>{String(record.data.title ?? record.data.name ?? record.id)}</h2>
                <button class="text-button" onClick={() => list.openDetail(record.id, "drawer")}>
                  详情
                </button>
              </article>
            )}
          </For>
        </div>
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
