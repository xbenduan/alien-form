import type { BuilderSchema, FieldSchema } from "@engine";

export interface ModelEditorValues {
  modelCode: string;
  title: string;
  description?: string;
  fieldsJson: string;
}

function assertPureSchema(value: unknown, path = "form-schema"): void {
  if (typeof value === "string" && value.includes("{{")) {
    throw new Error(`${path} must not contain expressions`);
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assertPureSchema(child, `${path}.${key}`);
  }
}

export function encodeModel(values: ModelEditorValues): BuilderSchema {
  const properties = JSON.parse(values.fieldsJson || "{}") as Record<string, FieldSchema>;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    throw new Error("字段 JSON 必须是对象");
  }
  if (Object.keys(properties).length === 0) throw new Error("至少需要一个模型字段");
  assertPureSchema(properties);

  const modelCode = values.modelCode.trim();
  const modelLiteral = JSON.stringify(modelCode);
  const formSchema: FieldSchema = { type: "object", properties };
  return {
    meta: {
      name: modelCode,
      title: values.title.trim(),
      description: values.description?.trim(),
      defaultPageSize: 20,
      openMode: "route",
    },
    "x-pages": [
      {
        router: "list",
        title: values.title.trim(),
        layout: {
          component: "layout",
          props: { rightTop: "filter", rightBottom: "table" },
        },
        schema: {
          properties: {
            filter: {
              type: "string",
              component: "filter",
              props: { schema: { $ref: "form-schema" } },
            },
            table: {
              type: "void",
              component: "table",
              props: {
                rowKey: "id",
                modelCode,
                schema: { $ref: "form-schema" },
                columns: "{{ $utils.schemaToColumns }}",
                filter: "{{ $values.filter }}",
                loadData: `{{ (params) => $service.records.list({ model: ${modelLiteral}, ...params }) }}`,
              },
            },
          },
        },
      },
      {
        router: "add",
        title: `新增${values.title.trim()}`,
        schema: {
          properties: {
            form: {
              type: "void",
              component: "record-form",
              props: {
                mode: "add",
                modelCode,
                schema: { $ref: "form-schema" },
              },
            },
          },
        },
      },
      {
        router: "edit",
        title: `编辑${values.title.trim()}`,
        schema: {
          properties: {
            form: {
              type: "void",
              component: "record-form",
              props: {
                mode: "edit",
                modelCode,
                recordId: "{{ $query.id }}",
                schema: { $ref: "form-schema" },
              },
            },
          },
        },
      },
      {
        router: "detail",
        title: `${values.title.trim()}详情`,
        schema: {
          properties: {
            form: {
              type: "void",
              component: "record-form",
              props: {
                mode: "detail",
                modelCode,
                recordId: "{{ $query.id }}",
                schema: { $ref: "form-schema" },
              },
            },
          },
        },
      },
    ],
    definitions: {
      "form-schema": formSchema,
    },
  };
}

export function decodeModel(model: BuilderSchema): ModelEditorValues {
  const formSchema = model.definitions?.["form-schema"];
  if (!formSchema?.properties) {
    throw new Error("模型缺少 definitions['form-schema'].properties");
  }
  return {
    modelCode: model.meta.name,
    title: model.meta.title,
    description: model.meta.description,
    fieldsJson: JSON.stringify(formSchema.properties, null, 2),
  };
}
