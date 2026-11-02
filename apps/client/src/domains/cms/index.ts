import { defineDomain } from "formwork";
import { RichText } from "./components/rich-text";
import { saveCmsRecord } from "./fn/save-record";
import { cmsDocumentSchema } from "./model.schema";

/** 为内容模型提供正文编辑、标题归一化和结构校验。 */
export default defineDomain({
  components: { RichText },
  fn: { saveRecord: saveCmsRecord },
  modelSchema: cmsDocumentSchema,
  transformSchema: (ctx) => ({
    ...ctx.schema,
    fields: {
      ...ctx.schema.fields,
      "/content": {
        ...ctx.schema.fields?.["/content"],
        form: { component: "RichText", ...ctx.schema.fields?.["/content"]?.form },
      },
    },
  }),
});
