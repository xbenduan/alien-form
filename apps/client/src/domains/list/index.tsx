import { defineDomain } from "formwork";
import { Detail, Editor, Records } from "formwork/atom";

/** 默认记录管理场景；slot 在操作打开后才创建详情与独立草稿。 */
export default defineDomain({
  router: "list",
  render: () => (
    <Records
      presentation="modal"
      detail={(operation) => <Detail operation={operation} />}
      create={(operation) => <Editor operation={operation} />}
      edit={(operation) => <Editor operation={operation} />}
    />
  ),
});
