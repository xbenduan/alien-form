import { createRecordPages, type AlienSchema } from "@alien-form/protocol";
import { modelForm, physicalField, systemFields } from "../../utils/system-model.ts";

/** Builds the category protocol from constants owned by the model entry. */
export default function createSchema(modelCode: string): AlienSchema {
  const [idField, createdAtField, updatedAtField] = systemFields(modelCode);

  const fields: AlienSchema["fields"] = [
    idField,
    physicalField(modelCode, "code", {
      type: "string",
      title: "分类标识",
      required: true,
      storage: { type: "text", unique: true, index: true },
      form: {
        component: "Input",
        pattern: "^[A-Za-z_][A-Za-z0-9_-]*$",
        props: { placeholder: "请输入分类标识" },
      },
    }),
    physicalField(modelCode, "name", {
      type: "string",
      title: "分类名称",
      required: true,
      storage: { type: "text", index: true },
      form: {
        component: "Input",
        pattern: "\\S",
        props: { placeholder: "请输入分类名称" },
      },
    }),
    physicalField(modelCode, "order", {
      type: "number",
      title: "排序",
      required: true,
      storage: { type: "integer", default: 0, index: true },
      form: { component: "NumberInput", default: 0, props: { min: 0 } },
    }),
    physicalField(modelCode, "aggregate", {
      type: "boolean",
      title: "聚合分类",
      required: true,
      storage: { type: "boolean", default: false },
      form: {
        component: "Select",
        default: false,
        dataSource: [
          { label: "是", value: true },
          { label: "否", value: false },
        ],
      },
    }),
    createdAtField,
    updatedAtField,
  ];

  return {
    name: modelCode,
    title: "分类标签",
    version: 1,
    system: true,
    subtitle: "Model Categories",
    description: "模型分类标签与模型归属配置。",
    group: "system",
    singularLabel: "分类标签",
    pluralLabel: "分类标签",
    defaultPageSize: 20,
    fields,
    form: modelForm(fields, ["code", "name", "order", "aggregate"]),
    pages: createRecordPages(modelCode, "分类标签", ["code", "name", "order", "aggregate"]),
  };
}
