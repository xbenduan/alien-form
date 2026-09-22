import type { Runtime } from "@alien-form/engine";
import { createId } from "./codec";
import { SYSTEM_FIELD_FORM } from "./system-fields";
import type { FieldNode, ModelDraft } from "./types";

/** 内置系统字段（id / createdAt / updatedAt），新建模型时预置。 */
function systemFields(): FieldNode[] {
  return [
    {
      id: createId(),
      key: "id",
      type: "string",
      title: "ID",
      required: true,
      source: "physical",
      // id 是所有模型的唯一主键（后端建为 PRIMARY KEY，按模型自增 MDM0000000001），
      // 故显式声明 唯一 + 非空 + 索引，作为模型的唯一索引。
      storage: {
        type: "text",
        system: true,
        unique: true,
        index: true,
        filterable: true,
      },
      form: { ...SYSTEM_FIELD_FORM },
    },
    {
      id: createId(),
      key: "createdAt",
      type: "string",
      title: "创建时间",
      required: true,
      source: "physical",
      storage: {
        type: "integer",
        system: true,
        filterable: true,
      },
      form: {
        component: "DatePicker",
        ...SYSTEM_FIELD_FORM,
        props: { readOnly: true, showTime: true },
      },
    },
    {
      id: createId(),
      key: "updatedAt",
      type: "string",
      title: "更新时间",
      required: true,
      source: "physical",
      storage: {
        type: "integer",
        system: true,
        filterable: true,
      },
      form: {
        component: "DatePicker",
        ...SYSTEM_FIELD_FORM,
        props: { readOnly: true, showTime: true },
      },
    },
  ];
}

export function createDefaultDraft(_runtime: Runtime): ModelDraft {
  return {
    name: "",
    title: "",
    version: 0,
    group: "other",
    defaultPageSize: 20,
    fields: [
      {
        id: createId(),
        key: "name",
        type: "string",
        title: "名称",
        required: true,
        source: "physical",
        storage: {
          type: "text",
          index: true,
          filterable: true,
        },
        form: { component: "Input" },
      },
      ...systemFields(),
    ],
    groups: [],
    pages: [],
  };
}
