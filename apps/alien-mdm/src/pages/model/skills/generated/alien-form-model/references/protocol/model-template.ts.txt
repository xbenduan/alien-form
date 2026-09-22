import { parseModelSchema } from "./assert.ts";
import { createDefaultPages } from "./page-templates.ts";
import type FieldSchema from "./field-schema.ts";
import type { ModelSchema } from "./model-schema.ts";

/** Shared form behavior for generated system fields. */
export const SYSTEM_FIELD_FORM: Pick<FieldSchema, "disabled" | "display"> = {
  display: "{{ mode === 'detail' ? 'visible' : 'none' }}",
  disabled: true,
};

/** Canonical starter model used by the editor and generated model Skill. */
export function createModelTemplate(): ModelSchema {
  const name = "example_model";
  const title = "示例模型";
  return parseModelSchema({
    name,
    title,
    version: 0,
    group: "other",
    singularLabel: title,
    pluralLabel: title,
    defaultPageSize: 20,
    fields: [
      {
        id: `${name}.name`,
        key: "name",
        storage: "physical",
        database: { type: "text", nullable: false, index: true },
        form: {
          type: "string",
          title: "名称",
          component: "Input",
          required: true,
        },
        table: { title: "名称" },
      },
      {
        id: `${name}.id`,
        key: "id",
        storage: "physical",
        database: {
          type: "text",
          system: true,
          nullable: false,
          unique: true,
          index: true,
        },
        form: { type: "string", title: "ID", ...SYSTEM_FIELD_FORM },
        table: { title: "ID" },
      },
      {
        id: `${name}.createdAt`,
        key: "createdAt",
        storage: "physical",
        database: {
          type: "integer",
          valueType: "string",
          system: true,
          nullable: false,
        },
        form: {
          type: "string",
          title: "创建时间",
          component: "DatePicker",
          ...SYSTEM_FIELD_FORM,
          props: { readOnly: true, showTime: true },
        },
        table: { title: "创建时间" },
      },
      {
        id: `${name}.updatedAt`,
        key: "updatedAt",
        storage: "physical",
        database: {
          type: "integer",
          valueType: "string",
          system: true,
          nullable: false,
        },
        form: {
          type: "string",
          title: "更新时间",
          component: "DatePicker",
          ...SYSTEM_FIELD_FORM,
          props: { readOnly: true, showTime: true },
        },
        table: { title: "更新时间" },
      },
    ],
    pages: createDefaultPages(name, title),
  });
}
