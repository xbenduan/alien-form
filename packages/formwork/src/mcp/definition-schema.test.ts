import { expect, it } from "vitest";
import { Validator } from "@cfworker/json-schema";
import { definitionJsonSchema } from "./definition-schema";
import { createDefinitionTemplate } from "./guide";
import { modelDefinitionSchema } from "../model/schema";
import type { ModelDefinition } from "../model/types";

it("公开 JSON Schema 与实际解析器接受相同字段协议，拒绝旧 envelope 和布局", () => {
  const validator = new Validator(
    definitionJsonSchema as ConstructorParameters<typeof Validator>[0],
  );
  const template = createDefinitionTemplate("schema-example");
  const complete: ModelDefinition = {
    ...template,
    domain: "shared",
    $defs: { city: { type: "string", minLength: 1 } },
    data: {
      ...template.data,
      optional: { type: "integer", enum: [1, null], default: null },
      ratio: { type: "number", minimum: 0, maximum: 1 },
      enabled: { type: "boolean", default: false },
      empty: { type: "null" },
      addresses: {
        type: "array",
        minItems: 0,
        maxItems: 5,
        items: { type: "object", properties: { city: { $ref: "#/$defs/city" } } },
      },
      title: { type: "string", props: { placeholder: "标题" }, ui: { filter: false } },
    },
  };
  for (const value of [template, complete]) {
    expect(validator.validate(value)).toMatchObject({ valid: true });
    expect(modelDefinitionSchema.safeParse(value).success).toBe(true);
  }
  for (const value of [
    {},
    { ...template, data: { type: "object" } },
    { ...template, fields: [] },
    { ...template, views: {} },
    { ...template, pages: {} },
    { document: template },
    { ...template, data: { title: { type: "string", ui: { form: { props: {} } } } } },
  ]) {
    expect(validator.validate(value).valid).toBe(false);
    expect(modelDefinitionSchema.safeParse(value).success).toBe(false);
  }
});
