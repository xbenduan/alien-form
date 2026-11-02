import { expect, it } from "vitest";
import { Validator } from "@cfworker/json-schema";
import { definitionJsonSchema } from "./definition-schema";
import { createDefinitionTemplate } from "./guide";
import { modelDefinitionSchema } from "../model/schema";
import type { ModelDefinition } from "../model/types";

it("公开 JSON Schema 描述完整文档而非空对象，并与实际解析器接受相同的构建示例", () => {
  const validator = new Validator(definitionJsonSchema);
  const template = createDefinitionTemplate("schema-example");
  const complete: ModelDefinition = {
    ...template,
    document: {
      ...template.document,
      domain: "shared",
      data: {
        ...template.document.data,
        $defs: { city: { type: "string", minLength: 1 } },
        properties: {
          ...template.document.data.properties,
          optional: { type: ["integer", "null"], enum: [1, null], default: null },
          ratio: { type: "number", minimum: 0, maximum: 1 },
          enabled: { type: "boolean", default: false },
          empty: { type: "null" },
          addresses: {
            type: "array",
            minItems: 0,
            maxItems: 5,
            items: { type: "object", properties: { city: { $ref: "#/$defs/city" } } },
          },
        },
      },
      fields: {
        "/title": {
          order: 0,
          form: { component: "Input", bindings: { disabled: "{{ $value === 'locked' }}" } },
          table: { title: "标题" },
          filter: false,
        },
        "/addresses/*/city": { form: { props: { placeholder: "城市" } }, table: false },
      },
      views: { "list/add": { component: "Object", children: [{ field: "/title" }] } },
      pages: { list: { windows: { add: { openMode: "modal" } } } },
    },
  };
  for (const value of [template, complete]) {
    expect(validator.validate(value)).toMatchObject({ valid: true });
    expect(modelDefinitionSchema.safeParse(value).success).toBe(true);
  }
  for (const document of [
    {},
    { ...template.document, data: { type: "object" } },
    { ...template.document, fields: [] },
    { ...template.document, views: { list: {} } },
    { ...template.document, pages: { list: { windows: { add: { openMode: "popup" } } } } },
  ]) {
    expect(validator.validate({ ...template, document }).valid).toBe(false);
    expect(modelDefinitionSchema.safeParse({ ...template, document }).success).toBe(false);
  }
});
