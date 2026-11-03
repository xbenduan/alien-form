import { baseFieldSchema } from "formwork/model";
import type { FieldContract, ModelDocument } from "formwork/model";

/** 共享 CMS 字段契约；richtext 保存普通字符串，不隐式解释为 HTML。 */
export const cmsContract: FieldContract = {
  formats: {
    richtext: {
      component: "RichText",
      schema: baseFieldSchema.refine((field) => field.type === "string", {
        path: ["type"],
        message: "richtext 必须保存 string",
      }),
    },
  },
};

/** 提供无 UI、无请求状态的领域契约目录，供浏览器和 Worker 共用。 */
export const domainContracts: Readonly<Record<string, FieldContract>> = { cms: cmsContract };

/** 选择领域值契约；不扩展 format 的领域仍可直接使用 Framework 契约。 */
export function modelContract(document: Pick<ModelDocument, "id" | "domain">): FieldContract {
  return domainContracts[document.domain ?? document.id] ?? {};
}
