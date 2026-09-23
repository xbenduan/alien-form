import type { AlienFieldSchema, AlienSchema } from "@alien-form/protocol";
export { createRecordPages as recordPages } from "@alien-form/protocol";

/** Creates a physical field owned by a built-in model. */
export function physicalField(
  model: string,
  key: string,
  definition: Omit<AlienSchema["fields"][number], "id" | "key"> & {
    storage: NonNullable<AlienSchema["fields"][number]["storage"]>;
  },
): AlienSchema["fields"][number] {
  return {
    id: `${model}.${key}`,
    key,
    ...definition,
  };
}

/** Creates a JSON-backed virtual field owned by a built-in model. */
export function virtualField(
  model: string,
  key: string,
  definition: Omit<AlienSchema["fields"][number], "id" | "key" | "storage">,
): AlienSchema["fields"][number] {
  return {
    id: `${model}.${key}`,
    key,
    ...definition,
  };
}

/** Builds the persisted form AST from field references and real Card nodes. */
export function modelForm(
  fields: AlienSchema["fields"],
  groupKeys: string[],
  extraGroups: Record<string, AlienFieldSchema> = {},
): AlienFieldSchema {
  const fieldKeys = new Set(fields.map((field) => field.key));
  const grouped = new Set(groupKeys);
  const properties: Record<string, AlienFieldSchema> = {
    base: {
      type: "void",
      component: "Card",
      title: "基础信息",
      props: { gridSpan: 12 },
      properties: Object.fromEntries(
        groupKeys.flatMap((key) =>
          fieldKeys.has(key) ? [[key, { $ref: `#/fields/${key}` }]] : [],
        ),
      ),
    },
    ...extraGroups,
  };
  for (const field of fields) {
    if (!grouped.has(field.key) && field.storage?.system !== true) {
      properties[field.key] = { $ref: `#/fields/${field.key}` };
    }
  }
  properties.system = {
    type: "void",
    component: "Card",
    title: "系统信息",
    display: "{{ mode === 'detail' ? 'visible' : 'none' }}",
    props: { gridSpan: 12 },
    properties: Object.fromEntries(
      fields
        .filter((field) => field.storage?.system)
        .map((field) => [field.key, { $ref: `#/fields/${field.key}` }]),
    ),
  };
  return { type: "object", properties };
}

/** Creates the common ID and timestamp fields used by built-in models. */
export function systemFields(model: string): AlienSchema["fields"] {
  const detailOnly = {
    display: "{{ mode === 'detail' ? 'visible' : 'none' }}" as const,
    disabled: true,
  };
  return [
    physicalField(model, "id", {
      type: "string",
      title: "ID",
      required: true,
      storage: { type: "text", system: true, unique: true, index: true },
      form: { ...detailOnly },
    }),
    physicalField(model, "createdAt", {
      type: "string",
      title: "创建时间",
      required: true,
      storage: { type: "integer", system: true },
      form: {
        component: "DatePicker",
        ...detailOnly,
        props: { readOnly: true, showTime: true },
      },
    }),
    physicalField(model, "updatedAt", {
      type: "string",
      title: "更新时间",
      required: true,
      storage: { type: "integer", system: true },
      form: {
        component: "DatePicker",
        ...detailOnly,
        props: { readOnly: true, showTime: true },
      },
    }),
  ];
}
