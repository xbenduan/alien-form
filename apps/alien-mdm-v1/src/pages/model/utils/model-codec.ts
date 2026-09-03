import type {
  BuilderSchema,
  DatabaseField,
  DatabaseSchema,
  DatabaseValueType,
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
  databaseJson: string;
  fieldsJson: string;
  groupsJson?: string;
  pagesJson?: string;
}

const DEFAULT_OPEN_MODES: ModelOpenModes = {
  add: "drawer",
  edit: "drawer",
  detail: "drawer",
};

const COLUMN_TYPES = new Set(["text", "integer", "real", "boolean", "json"]);
const VALUE_TYPES = new Set(["string", "number", "boolean", "object", "array"]);

function assertPureSchema(value: unknown, path = "form-schema"): void {
  if (typeof value === "string" && value.includes("{{")) {
    throw new Error(`${path} must not contain expressions`);
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "x-database") {
      throw new Error(`${path} 不允许包含 x-database，存储配置必须写入 database.fields`);
    }
    assertPureSchema(child, `${path}.${key}`);
  }
}

export function parseDatabase(raw: string): DatabaseSchema {
  const database = JSON.parse(raw || "{}") as DatabaseSchema;
  if (!database || typeof database !== "object" || Array.isArray(database)) {
    throw new Error("数据库 JSON 必须是对象");
  }
  if (!database.fields || typeof database.fields !== "object" || Array.isArray(database.fields)) {
    throw new Error("数据库 JSON 必须包含 fields 对象");
  }
  if (Object.keys(database.fields).length === 0) throw new Error("至少需要一个数据库字段");

  for (const [key, field] of Object.entries(database.fields)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`数据库字段名不合法：${key}`);
    }
    if (!field || typeof field !== "object" || !COLUMN_TYPES.has(field.type)) {
      throw new Error(`数据库字段 ${key} 的 type 不合法`);
    }
    if (field.valueType && !VALUE_TYPES.has(field.valueType)) {
      throw new Error(`数据库字段 ${key} 的 valueType 不合法`);
    }
    if (field.column && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.column)) {
      throw new Error(`数据库字段 ${key} 的 column 不合法`);
    }
    if (field.type !== "json" && (field.valueType === "object" || field.valueType === "array")) {
      throw new Error(`数据库字段 ${key} 只有 json 类型可以使用 object/array valueType`);
    }
    if (
      field.relation &&
      (!["many-to-one", "many-to-many"].includes(field.relation.kind) ||
        !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(field.relation.target) ||
        (field.relation.through && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.relation.through)))
    ) {
      throw new Error(`数据库字段 ${key} 的 relation 必须包含 kind 和 target`);
    }
  }
  return database;
}

function schemaType(field: DatabaseField): DatabaseValueType {
  if (field.valueType) return field.valueType;
  if (field.type === "integer" || field.type === "real") return "number";
  if (field.type === "boolean") return "boolean";
  if (field.type === "json") return "object";
  return "string";
}

function defaultComponent(type: DatabaseValueType): string {
  if (type === "number") return "NumberInput";
  if (type === "boolean") return "Switch";
  if (type === "object") return "ObjectField";
  if (type === "array") return "ArrayCards";
  return "Input";
}

function fieldTemplate(key: string, field: DatabaseField): FieldSchema {
  const type = schemaType(field);
  const template: FieldSchema = {
    type,
    title: field.title?.trim() || key,
    component: defaultComponent(type),
    ...(field.nullable === false ? { required: true } : {}),
    ...(field.filterable ? { "x-table": { filterable: true } } : {}),
  };
  if (type === "object") template.properties = {};
  if (type === "array") template.items = { type: "object", properties: {} };
  return template;
}

export function syncFieldsFromDatabase(
  database: DatabaseSchema,
  current: Record<string, FieldSchema> = {},
): Record<string, FieldSchema> {
  return Object.fromEntries(
    Object.entries(database.fields).map(([key, databaseField]) => {
      const template = fieldTemplate(key, databaseField);
      const existing = current[key];
      if (!existing) return [key, template];
      const merged: FieldSchema = {
        ...template,
        ...existing,
        type: template.type,
        required: template.required,
      };
      delete (merged as Record<string, unknown>)["x-database"];
      if (!template.required) delete merged.required;
      return [key, merged];
    }),
  );
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
            props: {
              schema: { $ref: "form-schema" },
              filters: "{{ $utils.schemaToFilters }}",
              defaultValue: "{{ $query.keyword }}",
            },
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

function parseProperties(raw: string, database: DatabaseSchema): Record<string, FieldSchema> {
  const properties = JSON.parse(raw || "{}") as Record<string, FieldSchema>;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    throw new Error("字段 JSON 必须是对象");
  }
  if (Object.keys(properties).length === 0) throw new Error("至少需要一个模型字段");
  assertPureSchema(properties);
  const databaseKeys = Object.keys(database.fields);
  const schemaKeys = Object.keys(properties);
  const missing = databaseKeys.filter((key) => !properties[key]);
  const extra = schemaKeys.filter((key) => !database.fields[key]);
  if (missing.length > 0) throw new Error(`Schema 缺少数据库字段：${missing.join(", ")}`);
  if (extra.length > 0) throw new Error(`Schema 包含非数据库字段：${extra.join(", ")}`);
  for (const key of databaseKeys) {
    const expected = schemaType(database.fields[key]);
    if (properties[key]?.type !== expected) {
      throw new Error(`Schema 字段 ${key} 的 type 必须为 ${expected}`);
    }
    const required = database.fields[key].nullable === false;
    if (Boolean(properties[key]?.required) !== required) {
      throw new Error(`Schema 字段 ${key} 的 required 必须与数据库 nullable 保持一致`);
    }
  }
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

function retargetValue<T>(value: T, sourceModelCode: string, targetModelCode: string): T {
  if (typeof value === "string") {
    if (value === sourceModelCode) return targetModelCode as T;
    const sourceLiteral = JSON.stringify(sourceModelCode);
    const targetLiteral = JSON.stringify(targetModelCode);
    return value.replaceAll(sourceLiteral, targetLiteral) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => retargetValue(item, sourceModelCode, targetModelCode)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        retargetValue(child, sourceModelCode, targetModelCode),
      ]),
    ) as T;
  }
  return value;
}

export function retargetModelPages(
  pages: XPage[],
  sourceModelCode: string,
  targetModelCode: string,
): XPage[] {
  return retargetValue(pages, sourceModelCode, targetModelCode);
}

export function retargetModelDatabase(
  database: DatabaseSchema,
  sourceModelCode: string,
  targetModelCode: string,
): DatabaseSchema {
  return {
    ...database,
    fields: Object.fromEntries(
      Object.entries(database.fields).map(([key, field]) => [
        key,
        field.relation?.target === sourceModelCode
          ? {
              ...field,
              relation: { ...field.relation, target: targetModelCode },
            }
          : field,
      ]),
    ),
  };
}

export function createModelCopyValues(model: BuilderSchema): ModelEditorValues {
  const values = decodeModel(model);
  const modelCode = `${model.meta.name}_copy`;
  return {
    ...values,
    modelCode,
    title: `${model.meta.title}副本`,
    databaseJson: JSON.stringify(
      retargetModelDatabase(model.database, model.meta.name, modelCode),
      null,
      2,
    ),
    pagesJson: JSON.stringify(
      retargetModelPages(model["x-pages"], model.meta.name, modelCode),
      null,
      2,
    ),
  };
}

export function encodeModel(values: ModelEditorValues): BuilderSchema {
  const modelCode = values.modelCode.trim();
  const title = values.title.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(modelCode)) {
    throw new Error("模型名只能使用字母、数字、下划线和中划线，且必须以字母或下划线开头");
  }
  const database = parseDatabase(values.databaseJson);
  const properties = parseProperties(values.fieldsJson, database);
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
    database,
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
  if (!model.database?.fields) {
    throw new Error("模型缺少 database.fields，请先迁移到数据库优先协议");
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
    databaseJson: JSON.stringify(model.database, null, 2),
    fieldsJson: JSON.stringify(formSchema.properties, null, 2),
    groupsJson: JSON.stringify(formSchema.group ?? [], null, 2),
    pagesJson: JSON.stringify(model["x-pages"], null, 2),
  };
}
