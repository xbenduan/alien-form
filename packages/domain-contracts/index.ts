import { baseFieldSchema } from "formwork/model";
import type { FieldContract } from "formwork/model";

/** 共享 CMS 字段契约；richtext 保存普通字符串，不隐式解释为 HTML。 */
export const cmsContract: FieldContract = {
  formats: {
    richtext: {
      schema: baseFieldSchema.refine((field) => field.type === "string", {
        path: ["type"],
        message: "richtext 必须保存 string",
      }),
    },
  },
};
