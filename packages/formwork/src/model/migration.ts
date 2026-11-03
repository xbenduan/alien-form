import { escapePointer, isObject, pointerSegments } from "./pointer";
import { modelIssues } from "./schema";
import { FormworkError } from "./errors";
import type {
  BackendOptions,
  FieldSchema,
  JsonValue,
  ModelDefinition,
  ValidationReport,
} from "./types";

/** 提供旧布局已经迁入页面代码的显式确认，以及关系目标和展示字段的解析依据。 */
export type LegacyMigrationOptions = {
  layoutsMigrated?: boolean;
  targets?: Readonly<Record<string, unknown>>;
  relationLabels?: Readonly<Record<string, string>>;
};

/** 转换旧作者协议并返回逐项诊断，不修改输入、数据库或原始布局。
 * @param options.layoutsMigrated 仅在旧 views/pages 已落实为 Page/Window 代码后设置。
 * @returns definition 是可审阅的候选；report.errors 非空时必须先解决诊断。
 */
export function migrateLegacyDefinition(
  input: unknown,
  options: LegacyMigrationOptions = {},
): {
  definition: ModelDefinition;
  report: ValidationReport;
} {
  if (!isObject(input) || !isObject(input.document) || typeof input.document.id !== "string")
    throw new FormworkError("INVALID_INPUT", "旧定义必须包含 document.id");
  const document = input.document;
  const root = isObject(document.data) ? document.data : {};
  const errors: ValidationReport["errors"][number][] = [];
  const runtimeChecks: ValidationReport["runtimeChecks"][number][] = [];
  const add = (path: string, message: string) =>
    errors.push({ path, code: "MIGRATION_REQUIRED", message });
  if (root.type !== "object" || !isObject(root.properties))
    add("/document/data", "旧根数据必须是 object/properties");
  for (const key of ["views", "pages"]) {
    if (!isObject(document[key]) || !Object.keys(document[key]).length) continue;
    if (!options.layoutsMigrated)
      add(`/document/${key}`, "先将此配置落实到 Page/Window 组件代码，再显式确认 layoutsMigrated");
    else
      runtimeChecks.push({
        path: `/document/${key}`,
        code: "LAYOUT_MIGRATED",
        message: "调用者已确认旧布局迁入页面代码；原配置仍保留在输入文件中",
      });
  }
  const presentation = isObject(document.fields) ? document.fields : {};
  const fields = new Map<string, FieldSchema>();
  const convert = (input: unknown, path: string, required = false): FieldSchema => {
    if (!isObject(input)) {
      add(`/document/data${path}`, "字段必须是对象");
      return {};
    }
    const {
      type,
      required: childRequired,
      properties,
      items,
      additionalProperties,
      $defs: _defs,
      ...metadata
    } = input;
    const field = structuredClone(metadata) as FieldSchema;
    if (typeof type === "string") field.type = type as FieldSchema["type"];
    else if (Array.isArray(type)) {
      field.type = type.find((value) => value !== "null") as FieldSchema["type"];
      if (type.includes("null") && !field.enum) field.nullable = true;
      if (type.length !== 2 || !type.includes("null"))
        add(`/document/data${path}/type`, "只支持单一类型与 null 的联合");
    }
    if (required) field.required = true;
    if (field.$ref && !field.$ref.startsWith("#/$defs/"))
      add(`/document/data${path}/$ref`, "请将非 $defs 引用提取到根 $defs");
    if (isObject(properties))
      field.properties = Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
          key,
          convert(
            value,
            `${path}/${escapePointer(key)}`,
            Array.isArray(childRequired) && childRequired.includes(key),
          ),
        ]),
      );
    if (items) {
      field.items = convert(items, `${path}/*`);
      if (field.items.enum) {
        field.enum = field.items.enum;
        delete field.items.enum;
      }
    }
    if (additionalProperties === false) field.additionalProperties = false;
    else if (isObject(additionalProperties))
      field.additionalProperties = convert(additionalProperties, `${path}/*`);
    else if (additionalProperties === true)
      add(`/document/data${path}/additionalProperties`, "开放字典需要明确值 Schema");
    fields.set(path, field);
    const overrides = presentation[path];
    if (isObject(overrides)) {
      const props: Record<string, JsonValue> = {};
      for (const scene of ["form", "filter", "table", "detail"] as const) {
        const config = overrides[scene];
        if (config === false) {
          (field.ui ??= {})[scene] = false;
          continue;
        }
        if (!isObject(config)) continue;
        const location = `/document/fields/${escapePointer(path)}/${scene}`;
        if (typeof config.component === "string") {
          const names: Record<string, string> = {
            Object: "ObjectFields",
            Array: "ArrayFields",
            Switch: "Boolean",
          };
          (field.ui ??= {})[scene] = { component: names[config.component] ?? config.component };
          if (
            scene === "form" &&
            config.component === "RichText" &&
            field.type === "string" &&
            document.domain === "cms"
          ) {
            field.format = "richtext";
            delete field.ui[scene];
          }
        }
        if (isObject(config.props))
          for (const [key, value] of Object.entries(config.props)) {
            if (Object.hasOwn(props, key) && JSON.stringify(props[key]) !== JSON.stringify(value))
              add(
                `${location}/props/${escapePointer(key)}`,
                "不同 scene 的同名 props 冲突，需要组件或业务代码明确处理",
              );
            else props[key] = value as JsonValue;
          }
        if (config.title !== undefined && config.title !== field.title)
          add(`${location}/title`, "独立表头文案需要迁入页面代码或统一为字段 title");
        for (const key of ["decorator", "state"])
          if (config[key] !== undefined)
            add(`${location}/${key}`, "装饰和动态状态请迁入页面或 scope 生命周期");
      }
      if (Object.keys(props).length) field.props = props;
    }
    return field;
  };
  const data = Object.fromEntries(
    Object.entries(isObject(root.properties) ? root.properties : {})
      .sort(([a], [b]) => {
        const order = (key: string) => {
          const config = presentation[`/${escapePointer(key)}`];
          return isObject(config) && typeof config.order === "number" ? config.order : 0;
        };
        return order(a) - order(b);
      })
      .map(([key, field]) => [
        key,
        convert(
          field,
          `/${escapePointer(key)}`,
          Array.isArray(root.required) && root.required.includes(key),
        ),
      ]),
  );
  const definition: ModelDefinition = {
    schemaVersion: 1,
    id: String(document.id),
    title: typeof document.title === "string" ? document.title : String(document.id),
    ...(typeof document.domain === "string" ? { domain: document.domain } : {}),
    data,
    ...(isObject(root.$defs)
      ? {
          $defs: Object.fromEntries(
            Object.entries(root.$defs).map(([key, field]) => [
              key,
              convert(field, `/$defs/${escapePointer(key)}`),
            ]),
          ),
        }
      : {}),
  };
  for (const path of Object.keys(presentation))
    if (!fields.has(path)) add(`/document/fields/${escapePointer(path)}`, "场景配置指向未知字段");
  if (isObject(document.tree)) definition.tree = document.tree as ModelDefinition["tree"];
  const backend = isObject(input.backend) ? input.backend : {};
  const storage = isObject(backend.storage) ? backend.storage : {};
  const bindings = Array.isArray(storage.bindings) ? storage.bindings.filter(isObject) : [];
  for (const binding of bindings) {
    const field = fields.get(String(binding.path));
    if (!field) {
      add("/backend/storage/bindings", `无法定位 binding ${String(binding.id)}`);
      continue;
    }
    field.id = String(binding.id);
    field.storage = {
      ...(typeof binding.column === "string" ? { column: binding.column } : {}),
      ...(typeof binding.jsonKey === "string" ? { jsonKey: binding.jsonKey } : {}),
      ...(binding.index === "index" || binding.index === "unique" ? { index: binding.index } : {}),
    };
  }
  const relations = Array.isArray(backend.relations) ? backend.relations.filter(isObject) : [];
  for (const relation of relations) {
    const binding = bindings.find((item) => item.id === relation.fieldId);
    const field = binding && fields.get(String(binding.path));
    if (!field || typeof relation.targetModel !== "string") {
      add("/backend/relations", "无法定位关系源字段或目标模型");
      continue;
    }
    const rawTarget =
      relation.targetModel === document.id ? input : options.targets?.[relation.targetModel];
    const target = isObject(rawTarget) ? rawTarget : {};
    const targetBackend = isObject(target.backend) ? target.backend : {};
    const targetStorage = isObject(targetBackend.storage) ? targetBackend.storage : {};
    const targetBinding =
      Array.isArray(targetStorage.bindings) &&
      targetStorage.bindings.find((item) => isObject(item) && item.id === relation.targetFieldId);
    const valueField =
      relation.targetFieldId === "id"
        ? "/id"
        : isObject(targetBinding)
          ? String(targetBinding.path)
          : undefined;
    if (!valueField)
      add(`/backend/relations/${String(relation.fieldId)}`, "请提供目标模型定义以解析稳定字段 id");
    const labelField = options.relationLabels?.[String(binding!.path)] ?? "/name";
    const targetDoc = isObject(target.document) ? target.document : {};
    const targetData = isObject(targetDoc.data) ? targetDoc.data : {};
    if (
      isObject(targetData.properties) &&
      !Object.hasOwn(targetData.properties, pointerSegments(labelField)[0] ?? "")
    )
      add(
        `/backend/relations/${String(relation.fieldId)}`,
        "默认 labelField 不存在，请显式提供 relationLabels",
      );
    field.relation = {
      model: relation.targetModel,
      ...(valueField ? { valueField } : {}),
      labelField,
    };
    if (typeof relation.through === "string")
      field.storage = { ...field.storage, through: relation.through };
  }
  definition.backend = {
    ...(typeof storage.table === "string" ? { storage: { table: storage.table } } : {}),
    ...(isObject(backend.permissions)
      ? { permissions: backend.permissions as BackendOptions["permissions"] }
      : {}),
    ...(isObject(backend.behavior)
      ? { behavior: backend.behavior as BackendOptions["behavior"] }
      : {}),
  };
  const inspect = (value: unknown, path: string) => {
    if (typeof value === "string" && /^\{\{[\s\S]*\}\}$/u.test(value.trim()))
      add(path, "表达式需要迁入 scope 或领域代码，不能作为普通字段 props 自动保留");
    if (isObject(value))
      for (const [key, child] of Object.entries(value))
        inspect(child, `${path}/${escapePointer(key)}`);
    if (Array.isArray(value)) value.forEach((child, index) => inspect(child, `${path}/${index}`));
  };
  inspect(definition, "");
  errors.push(...modelIssues(definition, { allowUnknownFormats: true }));
  return { definition, report: { errors, runtimeChecks } };
}
