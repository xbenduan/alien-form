import type { Runtime } from "@engine";
import { createId } from "./codec";
import type { FieldNode, ModelDraft } from "./types";

/** 内置系统字段（id / createdAt / updatedAt），新建模型时预置。 */
function systemFields(): FieldNode[] {
  return [
    {
      id: createId(),
      key: "id",
      type: "string",
      source: "field",
      // id 是所有模型的唯一主键（后端建为 PRIMARY KEY，按模型自增 MDM0000000001），
      // 故显式声明 唯一 + 非空 + 索引，作为模型的唯一索引。
      storage: {
        title: "ID",
        type: "text",
        system: true,
        nullable: false,
        unique: true,
        index: true,
        filterable: true,
      },
      form: { title: "ID", display: "hidden" },
    },
    {
      id: createId(),
      key: "createdAt",
      type: "string",
      source: "field",
      storage: {
        title: "创建时间",
        type: "integer",
        valueType: "string",
        system: true,
        filterable: true,
      },
      form: { title: "创建时间", props: { readOnly: true } },
    },
    {
      id: createId(),
      key: "updatedAt",
      type: "string",
      source: "field",
      storage: {
        title: "更新时间",
        type: "integer",
        valueType: "string",
        system: true,
        filterable: true,
      },
      form: { title: "更新时间", props: { readOnly: true } },
    },
  ];
}

export function createDefaultDraft(_runtime: Runtime): ModelDraft {
  return {
    name: "",
    title: "",
    group: "other",
    defaultPageSize: 20,
    fields: [
      {
        id: createId(),
        key: "name",
        type: "string",
        source: "field",
        storage: {
          title: "名称",
          type: "text",
          nullable: false,
          index: true,
          filterable: true,
        },
        form: { title: "名称", component: "Input" },
      },
      ...systemFields(),
    ],
    groups: [],
    pages: [],
  };
}
