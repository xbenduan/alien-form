import type { FieldSchema, ModelFieldDatabase, ModelFieldSchema } from "@alien-form/protocol";
export { createRecordPages as recordPages } from "@alien-form/protocol";

/** Creates a physical field owned by a built-in model. */
export function physicalField(
  model: string,
  key: string,
  database: ModelFieldDatabase,
  form: FieldSchema,
  options: Pick<ModelFieldSchema, "relation" | "table" | "filter"> = {},
): ModelFieldSchema {
  return {
    id: `${model}.${key}`,
    key,
    storage: "physical",
    database,
    form,
    ...options,
  };
}

/** Creates a JSON-backed virtual field owned by a built-in model. */
export function virtualField(model: string, key: string, form: FieldSchema): ModelFieldSchema {
  return {
    id: `${model}.${key}`,
    key,
    storage: "virtual",
    form,
  };
}

/** Creates the common ID and timestamp fields used by built-in models. */
export function systemFields(model: string): ModelFieldSchema[] {
  const detailOnly = {
    display: "{{ mode === 'detail' ? 'visible' : 'none' }}" as const,
    disabled: true,
  };
  return [
    physicalField(
      model,
      "id",
      { type: "text", system: true, nullable: false, unique: true, index: true },
      { type: "string", title: "ID", ...detailOnly },
      { table: { title: "ID" } },
    ),
    physicalField(
      model,
      "createdAt",
      { type: "integer", valueType: "string", system: true, nullable: false },
      {
        type: "string",
        title: "创建时间",
        component: "DatePicker",
        ...detailOnly,
        props: { readOnly: true, showTime: true },
      },
      { table: { title: "创建时间" } },
    ),
    physicalField(
      model,
      "updatedAt",
      { type: "integer", valueType: "string", system: true, nullable: false },
      {
        type: "string",
        title: "更新时间",
        component: "DatePicker",
        ...detailOnly,
        props: { readOnly: true, showTime: true },
      },
      { table: { title: "更新时间" } },
    ),
  ];
}
