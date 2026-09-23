import { parseAlienSchema } from "./assert.ts";
import { createDefaultPages, SYSTEM_FIELD_KEYS } from "./page-templates.ts";
import type { AlienFieldSchema, AlienSchema } from "./alien-schema.ts";

/** Shared form behavior for generated system fields. */
export const SYSTEM_FIELD_FORM: Pick<AlienFieldSchema, "disabled" | "display"> = {
  display: "{{ mode === 'detail' ? 'visible' : 'none' }}",
  disabled: true,
};

/** Canonical starter model used by the editor and generated model Skill. */
export function createModelTemplate(): AlienSchema {
  const name = "example_model";
  const title = "示例模型";
  return parseAlienSchema({
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
        type: "string",
        title: "名称",
        required: true,
        storage: { type: "text", index: true },
        form: { component: "Input" },
      },
      {
        id: `${name}.id`,
        key: "id",
        type: "string",
        title: "ID",
        required: true,
        storage: {
          type: "text",
          system: true,
          unique: true,
          index: true,
        },
        form: { ...SYSTEM_FIELD_FORM },
      },
      {
        id: `${name}.createdAt`,
        key: "createdAt",
        type: "string",
        title: "创建时间",
        required: true,
        storage: { type: "integer", system: true },
        form: {
          component: "DatePicker",
          ...SYSTEM_FIELD_FORM,
          props: { readOnly: true, showTime: true },
        },
      },
      {
        id: `${name}.updatedAt`,
        key: "updatedAt",
        type: "string",
        title: "更新时间",
        required: true,
        storage: { type: "integer", system: true },
        form: {
          component: "DatePicker",
          ...SYSTEM_FIELD_FORM,
          props: { readOnly: true, showTime: true },
        },
      },
    ],
    form: {
      type: "object",
      properties: {
        base: {
          type: "void",
          title: "基础信息",
          component: "Card",
          props: { gridSpan: 12 },
          properties: { name: { $ref: "#/fields/name" } },
        },
        system: {
          type: "void",
          title: "系统信息",
          component: "Card",
          display: "{{ mode === 'detail' ? 'visible' : 'none' }}",
          props: { gridSpan: 12 },
          properties: Object.fromEntries(
            SYSTEM_FIELD_KEYS.map((key) => [key, { $ref: `#/fields/${key}` }]),
          ),
        },
      },
    },
    pages: createDefaultPages(name, title),
  });
}
