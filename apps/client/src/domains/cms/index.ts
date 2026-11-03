import { defineDomain } from "formwork";
import { RichText } from "../../components/fields/rich-text";
import { saveCmsRecord } from "./fn/save-record";
import { cmsContract } from "../../../../../packages/domain-contracts";

/** 为内容模型提供正文编辑、标题归一化和结构校验。 */
export default defineDomain({
  ...cmsContract,
  components: { RichText },
  fn: { saveRecord: saveCmsRecord },
});
