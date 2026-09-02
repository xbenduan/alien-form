import type {
  BuilderSchema,
  FieldGroup,
  FieldSchema,
  ModelOpenModes,
  OpenMode,
  XPage,
} from "@engine";

export interface ModelEditorValues {
  modelCode: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: string;
  singularLabel?: string;
  pluralLabel?: string;
  filterCount?: number;
  defaultPageSize?: number;
  addOpenMode?: OpenMode;
  editOpenMode?: OpenMode;
  detailOpenMode?: OpenMode;
  fieldsJson: string;
  groupsJson?: string;
  pagesJson?: string;
}

const DEFAULT_OPEN_MODES: ModelOpenModes = {
  add: "drawer",
  edit: "drawer",
  detail: "drawer",
};

function assertPureSchema(value: unknown, path = "form-schema"): void {
  if (typeof value === "string" && value.includes("{{")) {
    throw new Error(`${path} must not contain expressions`);
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assertPureSchema(child, `${path}.${key}`);
  }
}

export function createDefaultPages(modelCode: string, title: string): XPage[] {
  const modelLiteral = JSON.stringify(modelCode.trim());
  const modelTitle = title.trim();
  return [
    {
      router: "list",
      title: modelTitle,
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
              modelCode: modelCode.trim(),
              schema: { $ref: "form-schema" },
              columns: "{{ $utils.schemaToColumns }}",
              filter: "{{ $values.filter }}",
              loadData: `{{ (params) => $service.records.list({ model: ${modelLiteral}, ...params }) }}`,
            },
          },
        },
      },
    },
    ...(["add", "edit", "detail"] as const).map((mode) => ({
      router: mode,
      title: `${mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情"}${modelTitle}`,
      schema: {
        properties: {
          form: {
            type: "void" as const,
            component: "record-form",
            props: {
              mode,
              modelCode: modelCode.trim(),
              recordId: mode === "add" ? undefined : "{{ $query.id }}",
              schema: { $ref: "form-schema" },
            },
          },
        },
      },
    })),
  ];
}

function parseProperties(raw: string): Record<string, FieldSchema> {
  const properties = JSON.parse(raw || "{}") as Record<string, FieldSchema>;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    throw new Error("字段 JSON 必须是对象");
  }
  if (Object.keys(properties).length === 0) throw new Error("至少需要一个模型字段");
  assertPureSchema(properties);
  return properties;
}

function parseGroups(
  raw: string | undefined,
  properties: Record<string, FieldSchema>,
): FieldGroup[] {
  const value = raw?.trim() ? (JSON.parse(raw) as unknown) : [];
  if (!Array.isArray(value)) throw new Error("分组 JSON 必须是数组");

  const assigned = new Set<string>();
  const groups = value.map((item, index) => {
    if (!item || typeof item !== "object" || !Array.isArray((item as FieldGroup).keys)) {
      throw new Error(`第 ${index + 1} 个分组必须包含 keys 数组`);
    }
    const group = item as FieldGroup;
    const keys = group.keys.map(String);
    for (const key of keys) {
      if (!properties[key]) throw new Error(`分组字段不存在：${key}`);
      if (assigned.has(key)) throw new Error(`字段不能重复分组：${key}`);
      assigned.add(key);
    }
    return {
      ...group,
      component: group.component?.trim() || "ObjectField",
      keys,
    };
  });
  assertPureSchema(groups, "form-schema.group");
  return groups.filter((group) => group.keys.length > 0);
}

function parsePages(raw: string | undefined, modelCode: string, title: string): XPage[] {
  const pages = raw?.trim() ? (JSON.parse(raw) as XPage[]) : createDefaultPages(modelCode, title);
  if (!Array.isArray(pages)) throw new Error("页面 JSON 必须是数组");
  const routers = new Set<string>();
  for (const page of pages) {
    if (!page || typeof page !== "object" || !page.router || !page.schema?.properties) {
      throw new Error("每个页面都必须包含 router 和 schema.properties");
    }
    routers.add(page.router);
  }
  for (const required of ["list", "add", "edit", "detail"]) {
    if (!routers.has(required)) throw new Error(`页面定义缺少 ${required} 页面`);
  }
  return pages;
}

export function encodeModel(values: ModelEditorValues): BuilderSchema {
  const modelCode = values.modelCode.trim();
  const title = values.title.trim();
  const properties = parseProperties(values.fieldsJson);
  const groups = parseGroups(values.groupsJson, properties);
  const openMode: ModelOpenModes = {
    add: values.addOpenMode ?? DEFAULT_OPEN_MODES.add,
    edit: values.editOpenMode ?? DEFAULT_OPEN_MODES.edit,
    detail: values.detailOpenMode ?? DEFAULT_OPEN_MODES.detail,
  };

  return {
    meta: {
      name: modelCode,
      title,
      subtitle: values.subtitle?.trim(),
      description: values.description?.trim(),
      group: values.group ?? "other",
      singularLabel: values.singularLabel?.trim() || title,
      pluralLabel: values.pluralLabel?.trim() || title,
      filterCount: Number(values.filterCount ?? 4),
      defaultPageSize: Number(values.defaultPageSize ?? 20),
      openMode,
    },
    "x-pages": parsePages(values.pagesJson, modelCode, title),
    definitions: {
      "form-schema": {
        type: "object",
        properties,
        ...(groups.length > 0 ? { group: groups } : {}),
      },
    },
  };
}

function resolveOpenModes(value: unknown): ModelOpenModes {
  if (typeof value === "string" && ["page", "drawer", "modal"].includes(value)) {
    return { add: value as OpenMode, edit: value as OpenMode, detail: value as OpenMode };
  }
  const modes = value as Partial<ModelOpenModes> | undefined;
  return {
    add: modes?.add ?? DEFAULT_OPEN_MODES.add,
    edit: modes?.edit ?? DEFAULT_OPEN_MODES.edit,
    detail: modes?.detail ?? DEFAULT_OPEN_MODES.detail,
  };
}

export function decodeModel(model: BuilderSchema): ModelEditorValues {
  const formSchema = model.definitions?.["form-schema"];
  if (!formSchema?.properties) {
    throw new Error("模型缺少 definitions['form-schema'].properties");
  }
  const openMode = resolveOpenModes(model.meta.openMode);
  return {
    modelCode: model.meta.name,
    title: model.meta.title,
    subtitle: model.meta.subtitle,
    description: model.meta.description,
    group: model.meta.group ?? "other",
    singularLabel: model.meta.singularLabel,
    pluralLabel: model.meta.pluralLabel,
    filterCount: model.meta.filterCount ?? 4,
    defaultPageSize: model.meta.defaultPageSize ?? 20,
    addOpenMode: openMode.add,
    editOpenMode: openMode.edit,
    detailOpenMode: openMode.detail,
    fieldsJson: JSON.stringify(formSchema.properties, null, 2),
    groupsJson: JSON.stringify(formSchema.group ?? [], null, 2),
    pagesJson: JSON.stringify(model["x-pages"], null, 2),
  };
}
