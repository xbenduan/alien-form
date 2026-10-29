import { modelDocumentSchema, modelIdPattern, escapePointer, isObject } from "formwork/model";
import type {
  DataSchema,
  JsonValue,
  ModelDefinition,
  StorageBinding,
  ModelAction,
} from "formwork/model";
import { createTableSql, literal, quote, bindingKey } from "../adapters/d1/compiler/storage";
import type { StorageManifest } from "../contracts";
import type { LegacyField, LegacyTable, MigrationInventory, MigrationPlan } from "./types";

const systemIds: Record<string, string> = {
  _sys_user: "system-users",
  _sys_role: "system-roles",
  _sys_model_category: "system-model-categories",
};
const actions = new Set(["read", "create", "update", "delete", "manage", "publish"]);
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
/** 计算与输入顺序无关的 JSON 值摘要，作为重复导入和数据守恒依据。 */
export async function valueDigest(value: unknown): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(value))),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function sqlValue(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("SQLite 数据包含非有限数");
    return String(value);
  }
  return literal(value);
}
function nodeSchema(input: Record<string, JsonValue>, fallback: string): DataSchema {
  if (typeof input.$ref === "string") {
    return {
      $ref: input.$ref
        .replace(/^#\/definitions\//u, "#/$defs/")
        .replace(/^#\/fields\//u, "#/properties/"),
    };
  }
  const type = typeof input.type === "string" && input.type !== "void" ? input.type : fallback;
  const metadata = Object.fromEntries(
    [
      "title",
      "description",
      "default",
      "pattern",
      "minLength",
      "maxLength",
      "minimum",
      "maximum",
      "minItems",
      "maxItems",
    ].flatMap((key) => (input[key] === undefined ? [] : [[key, input[key]]])),
  );
  if (type === "object") {
    const properties = isObject(input.properties) ? input.properties : {};
    return {
      ...metadata,
      type,
      properties: Object.fromEntries(
        Object.entries(properties).map(([key, value]) => {
          if (!isObject(value)) throw new Error(`嵌套字段 ${key} 不是对象`);
          return [key, nodeSchema(value as Record<string, JsonValue>, "string")];
        }),
      ),
      required: Array.isArray(input.required)
        ? (input.required as string[])
        : Object.entries(properties)
            .filter(([, value]) => isObject(value) && value.required === true)
            .map(([key]) => key),
    } as DataSchema;
  }
  if (type === "array") {
    if (
      !input.items &&
      input.component === "Select" &&
      isObject(input.props) &&
      input.props.multiple === true
    )
      return { ...metadata, type, items: { type: "string" } } as DataSchema;
    if (!isObject(input.items)) throw new Error("array.items 缺失或旧 tuple 无法自动转换");
    return {
      ...metadata,
      type,
      items: nodeSchema(input.items as Record<string, JsonValue>, "string"),
    } as DataSchema;
  }
  if (!["string", "number", "integer", "boolean", "null"].includes(type))
    throw new Error(`无法转换旧类型 ${type}`);
  const options = Array.isArray(input.dataSource) ? input.dataSource : [];
  const values = options.flatMap((option) =>
    isObject(option) && ["string", "number", "boolean"].includes(typeof option.value)
      ? [option.value]
      : [],
  );
  return {
    ...metadata,
    type,
    ...(values.length === options.length && values.length ? { enum: values } : {}),
  } as DataSchema;
}
function fieldSchema(field: LegacyField): DataSchema {
  const storage = field.storage?.type;
  // 日期和系统时间按已有物理整数描述，不改写旧值。
  const type = ["integer", "date"].includes(storage ?? "")
    ? "integer"
    : storage === "real"
      ? "number"
      : field.type;
  const node = nodeSchema(
    {
      ...field.form,
      type,
      ...(field.relation?.kind === "many-to-many" ? { items: { type: "string" } } : {}),
      ...(field.title ? { title: field.title } : {}),
    },
    type,
  );
  if (field.storage?.system || field.key === "passwordHash") node.readOnly = true;
  if (field.storage?.default !== undefined && !Object.hasOwn(node, "default"))
    node.default = field.storage.default;
  return node;
}
function bindingFor(field: LegacyField): StorageBinding {
  const column =
    field.key === "createdAt"
      ? "created_at"
      : field.key === "updatedAt"
        ? "updated_at"
        : (field.storage?.column ?? field.key);
  const many = field.relation?.kind === "many-to-many";
  return {
    id: field.id,
    path: `/${escapePointer(field.key)}`,
    ...(field.storage && !many ? { column } : { jsonKey: field.key }),
    sqlType: ["integer", "boolean", "date"].includes(field.storage?.type ?? "")
      ? "INTEGER"
      : field.storage?.type === "real"
        ? "REAL"
        : "TEXT",
    encoding:
      field.storage?.type === "json" ||
      (!field.storage && ["object", "array"].includes(field.type)) ||
      many
        ? "json"
        : "scalar",
    ...(field.key !== "id" && field.storage?.unique
      ? { index: "unique" as const }
      : field.storage?.index && !many
        ? { index: "index" as const }
        : {}),
  };
}
function fileDefinition(document: ModelDefinition["document"]): ModelDefinition {
  return {
    document,
    backend: {
      storage: {
        table: `biz_${document.id.replaceAll("-", "_")}`,
        bindings: Object.entries(document.data.properties).map(([key, node]) => {
          const type = "type" in node ? node.type : "string";
          return {
            id: `${document.id}:${key}`,
            path: `/${escapePointer(key)}`,
            column:
              key === "createdAt"
                ? "created_at"
                : key === "updatedAt"
                  ? "updated_at"
                  : key === "creatorId"
                    ? "creator_id"
                    : key,
            sqlType: ["boolean", "integer"].includes(String(type))
              ? "INTEGER"
              : type === "number"
                ? "REAL"
                : "TEXT",
            encoding: ["array", "object"].includes(String(type)) ? "json" : "scalar",
          };
        }),
      },
      relations: [],
      permissions: { grants: [], privateFields: [] },
      behavior: { rules: [], commands: {}, events: {} },
    },
  };
}
function tableSql(table: LegacyTable, target: string): string {
  if (table.foreignKeys.length || table.triggers.length)
    throw new Error(`表 ${table.name} 存在外键或 trigger，需要单独迁移`);
  if (
    table.columns.filter((column) => column.pk).length !== 1 ||
    !table.columns.some((column) => column.name === "id" && column.pk)
  ) {
    throw new Error(`表 ${table.name} 不是单一 id 主键`);
  }
  return `CREATE TABLE ${quote(target)} (${table.columns
    .map((column) => {
      if (!/^[A-Za-z0-9_ (),]*$/u.test(column.type))
        throw new Error(`表 ${table.name} 包含不支持的列类型`);
      return `${quote(column.name)} ${column.type || "TEXT"}${column.pk ? " PRIMARY KEY" : ""}${column.notnull && !column.pk ? " NOT NULL" : ""}${column.dflt_value === null ? "" : ` DEFAULT ${column.dflt_value}`}`;
    })
    .concat(
      table.columns.some((column) => column.name === "creator_id")
        ? []
        : ["\"creator_id\" TEXT NOT NULL DEFAULT ''"],
    )
    .join(", ")})`;
}
/** 把旧 D1 与文件状态转换成一次性迁移；任何无法守恒的字段、授权和关系阻止 apply。 */
export async function planMigration(input: MigrationInventory): Promise<MigrationPlan> {
  const digest = await valueDigest(input);
  const plan: MigrationPlan = {
    digest,
    mappings: {},
    models: [],
    tables: [],
    statements: [],
    errors: [],
    warnings: [],
  };
  const warn = (path: string, message: string) =>
    plan.warnings.push({ path, code: "LEGACY_PRESENTATION", message });
  const fail = (path: string, message: string) =>
    plan.errors.push({ path, code: "MIGRATION_REQUIRED", message });
  const byOld = new Map<string, ModelDefinition>();
  const usedTables = new Set<string>();
  try {
    for (const { schema, table } of input.models) {
      const id = systemIds[schema.name] ?? schema.name;
      if (!modelIdPattern.test(id) || (id.startsWith("system-") && !systemIds[schema.name]))
        throw new Error(`模型 ${schema.name} 无法映射为新 ID`);
      if (
        byOld.has(schema.name) ||
        plan.models.some((model) => model.definition.document.id === id)
      )
        throw new Error(`模型名称冲突 ${id}`);
      plan.mappings[schema.name] = id;
      const fields = schema.fields.filter((field) => field.type !== "void");
      if (
        new Set(fields.map((field) => field.id)).size !== fields.length ||
        new Set(fields.map((field) => field.key)).size !== fields.length
      )
        throw new Error(`${schema.name} 字段身份重复`);
      for (const field of fields) {
        if (field.form["x-validate"] || field.form["x-effect"] || field.form["x-format"])
          throw new Error(`${schema.name}.${field.key} 的旧可执行行为需要显式重写`);
      }
      const target = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(table)
        ? table
        : `legacy_${table.replaceAll("-", "_")}`;
      if (/^(fw_|sqlite_)/iu.test(target) || usedTables.has(target.toLowerCase()))
        throw new Error(`主表映射冲突或保留名称 ${target}`);
      usedTables.add(target.toLowerCase());
      const definition: ModelDefinition = {
        document: modelDocumentSchema.parse({
          id,
          title: schema.title,
          data: {
            type: "object",
            properties: Object.fromEntries(fields.map((field) => [field.key, fieldSchema(field)])),
            required: fields.filter((field) => field.required).map((field) => field.key),
            ...(schema.definitions
              ? {
                  $defs: Object.fromEntries(
                    Object.entries(schema.definitions).map(([key, value]) => [
                      key,
                      nodeSchema(value, "object"),
                    ]),
                  ),
                }
              : {}),
          },
        }),
        backend: {
          storage: { table: target, bindings: fields.map(bindingFor) },
          relations: [],
          permissions: {
            grants: [],
            privateFields: fields.filter((field) => field.private).map((field) => field.id),
          },
          behavior: {
            rules:
              id === "system-users"
                ? ["system.password", "system.users"]
                : id === "system-roles"
                  ? ["system.roles"]
                  : id === "system-model-categories"
                    ? ["system.categories"]
                    : [],
            commands: {},
            events: {},
          },
        },
      };
      byOld.set(schema.name, definition);
      const manifest: StorageManifest = {
        table: target,
        bindings: definition.backend.storage.bindings.map((binding) => ({
          ...binding,
          active: true,
        })),
        relations: [],
      };
      const actual = input.tables.find((item) => item.name === table);
      if (!actual) throw new Error(`物理表 ${table} 不存在`);
      for (const binding of manifest.bindings)
        if (binding.column && !actual.columns.some((column) => column.name === binding.column))
          throw new Error(`${schema.name} 字段 ${binding.id} 的物理列不存在`);
      for (const column of actual.columns)
        if (
          !["id", "created_at", "updated_at", "creator_id", "data_content"].includes(column.name) &&
          !manifest.bindings.some((binding) => binding.column === column.name)
        ) {
          manifest.bindings.push({
            id: `physical:${column.name}`,
            path: `/${escapePointer(column.name)}`,
            column: column.name,
            sqlType: /INT/iu.test(column.type)
              ? "INTEGER"
              : /REAL/iu.test(column.type)
                ? "REAL"
                : "TEXT",
            encoding: "scalar",
            active: false,
          });
        }
      const migratedRows = actual.rows.map((row) => {
        const content = JSON.parse(String(row.data_content ?? "{}")) as Record<string, JsonValue>;
        return {
          ...row,
          creator_id:
            row.creator_id ?? (typeof content.__ownerId === "string" ? content.__ownerId : ""),
        };
      });
      plan.tables.push({
        source: table,
        target,
        count: actual.rows.length,
        digest: await valueDigest(migratedRows),
        rows: migratedRows,
      });
      plan.statements.push(tableSql(actual, target));
      for (const row of migratedRows)
        plan.statements.push(
          `INSERT INTO ${quote(target)} (${Object.keys(row).map(quote).join(",")}) VALUES (${Object.values(row).map(sqlValue).join(",")})`,
        );
      for (const [index, item] of actual.indexes.entries()) {
        if (item.origin === "pk") continue;
        if (!item.columns.length || item.columns.some((column) => !column))
          throw new Error(`表 ${table} 的表达式索引必须显式迁移`);
        plan.statements.push(
          `CREATE ${item.unique ? "UNIQUE " : ""}INDEX ${quote(`import_${target}_${index}`)} ON ${quote(target)} (${item.columns.map(quote).join(",")})`,
        );
      }
      plan.models.push({
        definition,
        manifest,
        creatorId: schema.creatorId ?? input.identities?.bootstrap ?? "migration-input",
        stage: "published",
        legacyVersion: schema.version,
      });
      warn(
        `/models/${schema.name}/pages`,
        "旧布局、组件 props 和表达式不执行；使用新的默认 CRUD View，原始输入保留在迁移记录。",
      );
    }
    for (const { schema } of input.models) {
      const model = plan.models.find((item) => item.definition === byOld.get(schema.name))!;
      for (const field of schema.fields)
        if (field.relation) {
          const target = byOld.get(field.relation.target);
          if (!target) throw new Error(`关系目标 ${field.relation.target} 缺失`);
          const targetKey = field.relation.valueField ?? "id";
          const targetBinding = target.backend.storage.bindings.find(
            (binding) => bindingKey(binding) === targetKey,
          );
          if (!targetBinding && targetKey !== "id")
            throw new Error(`关系目标字段 ${field.relation.target}.${targetKey} 缺失`);
          const through =
            field.relation.kind === "many-to-many"
              ? (field.relation.through ?? `${schema.name}_${field.key}`)
              : undefined;
          const relation = {
            fieldId: field.id,
            targetModel: target.document.id,
            targetFieldId: targetBinding?.id ?? "id",
            kind: field.relation.kind,
            ...(through ? { through } : {}),
          };
          model.definition.backend.relations = [...model.definition.backend.relations, relation];
          model.manifest.relations.push({ ...relation, active: true, table: through });
          const sourceRows = input.tables.find(
            (item) => item.name === input.models.find((item) => item.schema === schema)!.table,
          )!.rows;
          const targetRows = input.tables.find(
            (item) =>
              item.name ===
              input.models.find((item) => item.schema.name === field.relation!.target)!.table,
          )!.rows;
          const targetValue = (row: LegacyTable["rows"][number]) =>
            targetBinding?.jsonKey
              ? JSON.parse(String(row.data_content ?? "{}"))[targetBinding.jsonKey]
              : row[targetBinding?.column ?? targetKey];
          if (through) {
            quote(through);
            if (usedTables.has(through.toLowerCase()) || /^(fw_|sqlite_)/iu.test(through))
              throw new Error(`through 表冲突 ${through}`);
            usedTables.add(through.toLowerCase());
            const table = input.tables.find((item) => item.name === through);
            if (!table || table.foreignKeys.length || table.triggers.length)
              throw new Error(`关系表 ${through} 缺失或包含额外约束`);
            if (
              table.columns.some((column) => !["source_id", "target_value"].includes(column.name))
            )
              throw new Error(`关系表 ${through} 包含额外列，需要显式保留映射`);
            const pairs = new Set<string>();
            for (const edge of table.rows) {
              const pair = `${edge.source_id}\u0000${edge.target_value}`;
              if (
                pairs.has(pair) ||
                !sourceRows.some((row) => row.id === edge.source_id) ||
                !targetRows.some((row) => String(targetValue(row)) === String(edge.target_value))
              )
                throw new Error(`关系表 ${through} 有重复边或悬空引用`);
              pairs.add(pair);
            }
            plan.tables.push({
              source: through,
              target: through,
              rows: table.rows,
              count: table.rows.length,
              digest: await valueDigest(table.rows),
            });
            plan.statements.push(
              `CREATE TABLE ${quote(through)} ("source_id" TEXT NOT NULL,"target_value" TEXT NOT NULL,PRIMARY KEY("source_id","target_value"))`,
            );
            for (const row of table.rows)
              plan.statements.push(
                `INSERT INTO ${quote(through)} (source_id,target_value) VALUES (${sqlValue(row.source_id!)},${sqlValue(row.target_value!)})`,
              );
            plan.statements.push(
              `INSERT INTO fw_relation_tables(source_model_id,field_id,table_name) VALUES (${literal(model.definition.document.id)},${literal(field.id)},${literal(through)})`,
            );
          } else {
            const sourceBinding = model.definition.backend.storage.bindings.find(
              (binding) => binding.id === field.id,
            )!;
            for (const row of sourceRows) {
              const value = sourceBinding.column
                ? row[sourceBinding.column]
                : JSON.parse(String(row.data_content ?? "{}"))[sourceBinding.jsonKey!];
              if (
                value !== undefined &&
                value !== null &&
                value !== "" &&
                !targetRows.some((target) => targetValue(target) === value)
              )
                throw new Error(`关系 ${schema.name}.${field.key} 有悬空引用`);
            }
          }
        }
    }
    const roles = input.models.find((model) => model.schema.name === "_sys_role");
    if (roles) {
      for (const row of input.tables.find((table) => table.name === roles.table)!.rows) {
        const content = JSON.parse(String(row.data_content ?? "{}")) as Record<string, unknown>;
        const grants = content.permissions;
        if (grants !== undefined && !Array.isArray(grants))
          throw new Error(`角色 ${row.id} permissions 不是数组`);
        for (const grant of grants ?? []) {
          if (
            !isObject(grant) ||
            typeof grant.model !== "string" ||
            !Array.isArray(grant.actions) ||
            !Array.isArray(grant.fields) ||
            !["all", "own"].includes(String(grant.scope))
          )
            throw new Error(`角色 ${row.id} grant 不完整`);
          const target = byOld.get(grant.model);
          if (!target || grant.actions.some((action) => !actions.has(String(action))))
            throw new Error(`角色 ${row.id} grant 引用了未知模型或 action`);
          const fieldIds = grant.fields.map((key) => {
            const binding = target.backend.storage.bindings.find(
              (binding) => bindingKey(binding) === key,
            );
            if (!binding) throw new Error(`角色 ${row.id} grant 引用了未知字段 ${String(key)}`);
            return binding.id;
          });
          target.backend.permissions.grants = [
            ...target.backend.permissions.grants,
            {
              roleId: String(row.id),
              actions: grant.actions as ModelAction[],
              fields: fieldIds,
              scope: grant.scope as "all" | "own",
            },
          ];
        }
      }
    }
    for (const file of input.files) {
      const document = modelDocumentSchema.parse(file.document);
      if (
        plan.models.some((model) => model.definition.document.id === document.id) ||
        document.id.startsWith("system-")
      )
        throw new Error(`文件模型 ID 冲突 ${document.id}`);
      const definition = fileDefinition(document);
      const manifest: StorageManifest = {
        table: definition.backend.storage.table,
        bindings: definition.backend.storage.bindings.map((binding) => ({
          ...binding,
          active: true,
        })),
        relations: [],
      };
      const creatorId = file.creatorId ?? input.identities?.bootstrap ?? "migration-input";
      plan.models.push({
        definition,
        manifest,
        stage: file.published ? "published" : "draft",
        creatorId,
        legacyVersion: null,
      });
      if (!file.published && file.records.length)
        throw new Error(`未发布文件样例 ${document.id} 不能创建业务记录表`);
      if (file.published) {
        if (usedTables.has(manifest.table.toLowerCase()))
          throw new Error(`文件模型表冲突 ${manifest.table}`);
        usedTables.add(manifest.table.toLowerCase());
        plan.statements.push(createTableSql(manifest.table, manifest.bindings));
        const rows: LegacyTable["rows"] = [];
        for (const record of file.records) {
          if (typeof record.id !== "string") throw new Error(`${document.id} 文件记录缺少 id`);
          const row: LegacyTable["rows"][number] = {
            id: record.id,
            created_at: (record.createdAt as string) ?? "",
            updated_at: (record.updatedAt as string) ?? "",
            creator_id: (record.creatorId as string) ?? "",
            data_content: JSON.stringify(record),
          };
          for (const binding of manifest.bindings) {
            if (
              !binding.column ||
              ["id", "created_at", "updated_at", "creator_id"].includes(binding.column)
            )
              continue;
            const value = record[bindingKey(binding)];
            row[binding.column] =
              value === undefined || value === null
                ? null
                : binding.encoding === "json"
                  ? JSON.stringify(value)
                  : typeof value === "boolean"
                    ? Number(value)
                    : (value as string | number);
          }
          rows.push(row);
          plan.statements.push(
            `INSERT INTO ${quote(manifest.table)} (${Object.keys(row).map(quote).join(",")}) VALUES (${Object.values(row).map(sqlValue).join(",")})`,
          );
        }
        plan.tables.push({
          source: `files:${document.id}`,
          target: manifest.table,
          count: rows.length,
          rows,
          digest: await valueDigest(rows),
        });
      }
    }
    const now = new Date().toISOString();
    for (const model of plan.models) {
      const id = model.definition.document.id;
      const revision = crypto.randomUUID();
      plan.statements.push(
        `INSERT INTO fw_models(id,creator_id,active_version,management_revision,storage_table,created_at,updated_at) VALUES (${literal(id)},${literal(model.creatorId)},${model.stage === "published" ? "1" : "NULL"},${literal(revision)},${model.stage === "published" ? literal(model.manifest.table) : "NULL"},${literal(now)},${literal(now)})`,
      );
      if (model.stage === "published")
        plan.statements.push(
          `INSERT INTO fw_model_versions(model_id,version,definition_json,storage_manifest_json,publish_revision,published_by,published_at) VALUES (${literal(id)},1,${literal(JSON.stringify(model.definition))},${literal(JSON.stringify(model.manifest))},${literal(crypto.randomUUID())},${literal(model.creatorId)},${literal(now)})`,
        );
      else
        plan.statements.push(
          `INSERT INTO fw_model_drafts(model_id,base_version,definition_json,diagnostics_json,updated_by,updated_at) VALUES (${literal(id)},NULL,${literal(JSON.stringify(model.definition))},'{"errors":[],"runtimeChecks":[]}',${literal(model.creatorId)},${literal(now)})`,
        );
    }
    if (input.identities) {
      if (!byOld.has("_sys_user") || !byOld.has("_sys_role"))
        throw new Error("旧身份迁移缺少用户/角色定义");
      const users = input.tables.find(
        (table) =>
          table.name === input.models.find((model) => model.schema.name === "_sys_user")!.table,
      )!;
      const roles = input.tables.find(
        (table) =>
          table.name === input.models.find((model) => model.schema.name === "_sys_role")!.table,
      )!;
      if (
        !users.rows.some((row) => row.id === input.identities!.bootstrap) ||
        !roles.rows.some(
          (row) => row.id === input.identities!.superRole && row.code === "super_admin",
        )
      )
        throw new Error("可信身份指向不存在的用户或超级角色");
      const entries = {
        bootstrap: input.identities.bootstrap,
        "super-role": input.identities.superRole,
        ...Object.fromEntries(
          Object.entries(input.identities.categories).map(([key, id]) => [`category:${key}`, id]),
        ),
      };
      for (const [name, id] of Object.entries(entries))
        plan.statements.push(
          `INSERT INTO fw_system_identities(name,record_id) VALUES (${literal(name)},${literal(id)})`,
        );
    } else if (input.models.some((item) => systemIds[item.schema.name]))
      throw new Error("系统模型迁移需要显式可信身份映射");
    if (input.tables.some((table) => table.name === "_outbox"))
      warn(
        "/tables/_outbox",
        "旧事件及投递状态完整保留在迁移输入记录中；旧 handler 需审阅后显式重写，不能自动重放。",
      );
    plan.statements.push(
      `INSERT INTO fw_migration_runs(input_hash,mapping_json,status,report_json,completed_at) VALUES (${literal(digest)},${literal(JSON.stringify({ models: plan.mappings, source: input }))},'complete',${literal(JSON.stringify(plan.tables.map(({ source, target, count, digest }) => ({ source, target, count, digest }))))},${literal(now)})`,
    );
  } catch (error) {
    fail("/", error instanceof Error ? error.message : String(error));
    plan.statements = [];
  }
  return plan;
}
