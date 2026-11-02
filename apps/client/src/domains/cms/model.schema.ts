import { modelDocumentSchema } from "formwork/model";

/** 校验 cms 的完整模型，并要求正文仍使用字符串存储。 */
export const cmsDocumentSchema = modelDocumentSchema
  .refine(
    (document) =>
      document.data.properties.content !== undefined &&
      "type" in document.data.properties.content &&
      document.data.properties.content.type === "string",
    { path: ["data", "properties", "content"], message: "cms 正文必须是 string 字段" },
  );
