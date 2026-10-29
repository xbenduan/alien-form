import { z } from "zod";
import { applyDefaults, isObject, resolveSchema, schemaType, validateValue } from "formwork/model";
import type {
  JsonValue,
  RecordValue,
  RecordPage,
  RecordQuery,
  StorageBinding,
} from "formwork/model";
import type { Actor, StoredModel } from "../contracts";
import { readHead, readPublished, transactionGuard } from "../adapters/d1/repositories/models";
import { bindingKey, bindingExpression, quote } from "../adapters/d1/compiler/storage";
import {
  encodeValue,
  mergeContent,
  readRow,
  withRelations,
} from "../adapters/d1/repositories/values";
import type { PhysicalRow } from "../adapters/d1/repositories/values";
import { accessFor, requireAccess, projectRecord } from "./auth/access";
import type { Access } from "./auth/access";
import { prepareAndValidate, systemAssertions } from "./behaviors/rules";
import { outboxStatements } from "./outbox";
import { assertModelId } from "./model-service";
import { forbidden, invalid, notFound, ServiceError } from "../http/errors";

const metadata = new Set(["id", "createdAt", "updatedAt", "creatorId"]);
const querySchema = z
  .object({
    filters: z.record(z.string(), z.json()),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(200),
    sort: z
      .object({ field: z.string(), direction: z.enum(["asc", "desc"]) })
      .strict()
      .optional(),
    keyword: z.string().optional(),
    parentId: z.string().optional(),
  })
  .strict();
const idsSchema = z.array(z.string().min(1)).min(1).max(200);

function recordInput(input: unknown): RecordValue {
  if (!isObject(input)) invalid("记录必须是 JSON object");
  return input as RecordValue;
}
function checkedField(model: StoredModel, access: Access, key: string): StorageBinding {
  if (!access.fields.has(key) && key !== "id") forbidden("字段不允许用于筛选或排序");
  const binding = model.definition.backend.storage.bindings.find(
    (item) => bindingKey(item) === key,
  );
  if (!binding) {
    if (key === "id")
      return { id: "id", path: "/id", column: "id", sqlType: "TEXT", encoding: "scalar" };
    invalid(`未知字段 ${key}`);
  }
  if (binding.encoding === "json") invalid(`字段 ${key} 不能使用标量查询`);
  return binding;
}
function predicates(model: StoredModel, actor: Actor, access: Access, query: RecordQuery) {
  const sql: string[] = [],
    values: (string | number | null)[] = [];
  if (access.scope === "own") {
    sql.push('"creator_id" = ?');
    values.push(actor.id);
  }
  const filters = { ...query.filters };
  if (query.parentId !== undefined) {
    const relation = model.definition.backend.relations.find(
      (item) => item.kind === "many-to-one" && item.targetModel === model.head.id,
    );
    if (!relation) invalid("模型未声明父级关系");
    const binding = model.definition.backend.storage.bindings.find(
      (item) => item.id === relation.fieldId,
    )!;
    filters[bindingKey(binding)] = query.parentId;
  }
  for (const [key, value] of Object.entries(filters)) {
    const binding = checkedField(model, access, key);
    const schema = model.definition.document.data.properties[key] ?? { type: "string" as const };
    // Filter strings are partial matches, so minLength/enum are not record constraints here.
    const type = schemaType(resolveSchema(schema, model.definition.document.data));
    if (
      value !== null &&
      (type === "integer"
        ? typeof value !== "number" || !Number.isInteger(value)
        : type === "number"
          ? typeof value !== "number" || !Number.isFinite(value)
          : typeof value !== type)
    )
      invalid(`筛选字段 ${key} 需要 ${type}`);
    const expression = bindingExpression(binding);
    if (value === null) {
      const resolved = resolveSchema(schema, model.definition.document.data);
      if (!("type" in resolved) || !(resolved.type === "null" || Array.isArray(resolved.type)))
        invalid(`筛选字段 ${key} 不允许 null`);
      sql.push(`${expression} IS NULL`);
    } else if (
      typeof value === "string" &&
      key !== "id" &&
      !("enum" in schema) &&
      !model.definition.backend.relations.some((relation) => relation.fieldId === binding.id)
    ) {
      sql.push(`instr(${expression}, ?) > 0`);
      values.push(value);
    } else {
      sql.push(`${expression} = ?`);
      values.push(encodeValue(binding, value));
    }
  }
  if (query.keyword) {
    const strings = model.definition.backend.storage.bindings.filter(
      (binding) =>
        access.fields.has(bindingKey(binding)) &&
        binding.encoding === "scalar" &&
        schemaType(
          resolveSchema(
            model.definition.document.data.properties[bindingKey(binding)]!,
            model.definition.document.data,
          ),
        ) === "string",
    );
    if (strings.length) {
      sql.push(
        `(${strings.map((binding) => `instr(${bindingExpression(binding)}, ?) > 0`).join(" OR ")})`,
      );
      values.push(...strings.map(() => query.keyword!));
    } else sql.push("0");
  }
  return { sql: sql.length ? `WHERE ${sql.join(" AND ")}` : "", values };
}

/** 对当前已发布模型执行字段授权、隐藏值合并和版本受保护的记录事务。 */
export class RecordService {
  constructor(
    private readonly db: D1Database,
    private readonly actor: Actor,
  ) {}
  private async model(id: string) {
    assertModelId(id);
    return readPublished(this.db, id);
  }
  async query(id: string, input: unknown): Promise<RecordPage> {
    const query = querySchema.parse(input) as RecordQuery;
    const model = await this.model(id),
      access = requireAccess(model, this.actor, "read");
    const where = predicates(model, this.actor, access, query);
    const sort = query.sort
      ? `${bindingExpression(checkedField(model, access, query.sort.field))} ${query.sort.direction.toUpperCase()}, id ASC`
      : "created_at DESC, id ASC";
    const [count, rows] = await this.db.batch([
      this.db
        .prepare(`SELECT COUNT(*) AS total FROM ${quote(model.manifest.table)} ${where.sql}`)
        .bind(...where.values),
      this.db
        .prepare(
          `SELECT * FROM ${quote(model.manifest.table)} ${where.sql} ORDER BY ${sort} LIMIT ? OFFSET ?`,
        )
        .bind(...where.values, query.pageSize, (query.page - 1) * query.pageSize),
    ]);
    const list: RecordValue[] = [];
    for (const row of rows.results as PhysicalRow[])
      list.push(projectRecord(await withRelations(this.db, model, row), access));
    return { total: Number((count.results[0] as { total: number }).total), list };
  }
  async read(id: string, recordId: string): Promise<RecordValue> {
    const model = await this.model(id);
    const row = await readRow(this.db, model, recordId);
    if (!row) notFound("记录不存在");
    const record = await withRelations(this.db, model, row);
    return projectRecord(record, requireAccess(model, this.actor, "read", record));
  }
  private async relationAssertions(model: StoredModel, record: RecordValue, input: RecordValue) {
    const assertions: { sql: string; values: (string | number | null)[] }[] = [];
    for (const relation of model.definition.backend.relations) {
      const binding = model.definition.backend.storage.bindings.find(
        (item) => item.id === relation.fieldId,
      )!;
      const key = bindingKey(binding),
        value = record[key];
      const targets =
        relation.kind === "many-to-many"
          ? Array.isArray(value)
            ? [...new Set(value)]
            : []
          : value === null || value === undefined || value === ""
            ? []
            : [value];
      if (relation.kind === "many-to-many" && Array.isArray(value)) record[key] = targets;
      if (targets.length > 200) invalid("一次记录提交最多关联 200 个目标");
      const target = await readPublished(this.db, relation.targetModel);
      const targetBinding = target.definition.backend.storage.bindings.find(
        (item) => item.id === relation.targetFieldId,
      );
      const expression = targetBinding ? bindingExpression(targetBinding) : '"id"';
      const targetAccess = accessFor(target, this.actor, "read");
      if (Object.hasOwn(input, key) && !targetAccess.allowed) forbidden("没有读取关系目标的权限");
      for (const item of targets) {
        if (typeof item !== "string") invalid("关系值必须是 string");
        const owned = Object.hasOwn(input, key) && targetAccess.scope === "own";
        const sql = `EXISTS(SELECT 1 FROM ${quote(target.manifest.table)} WHERE ${expression} = ?${owned ? " AND creator_id = ?" : ""})`;
        const values = owned ? [item, this.actor.id] : [item];
        if (
          !(await this.db
            .prepare(`SELECT 1 WHERE ${sql}`)
            .bind(...values)
            .first())
        )
          invalid(`关系字段 ${key} 引用了不存在或不可见的目标`);
        assertions.push({ sql, values });
      }
      assertions.push({
        sql: "EXISTS(SELECT 1 FROM fw_models WHERE id = ? AND active_version = ?)",
        values: [target.head.id, target.version],
      });
    }
    return assertions;
  }
  private async deletionAssertions(model: StoredModel, record: RecordValue) {
    const assertions: { sql: string; values: (string | number | null)[] }[] = [];
    const rows = (
      await this.db
        .prepare(
          `SELECT v.definition_json, v.storage_manifest_json FROM fw_models m JOIN fw_model_versions v
       ON m.id = v.model_id AND m.active_version = v.version`,
        )
        .all<{ definition_json: string; storage_manifest_json: string }>()
    ).results;
    for (const row of rows) {
      const definition = JSON.parse(row.definition_json) as StoredModel["definition"];
      const manifest = JSON.parse(row.storage_manifest_json) as StoredModel["manifest"];
      for (const relation of manifest.relations.filter(
        (item) => item.active && item.targetModel === model.head.id,
      )) {
        const sourceBinding = definition.backend.storage.bindings.find(
          (item) => item.id === relation.fieldId,
        )!;
        const targetBinding = model.definition.backend.storage.bindings.find(
          (item) => item.id === relation.targetFieldId,
        );
        const value = targetBinding ? record[bindingKey(targetBinding)] : record.id;
        const self = definition.document.id === model.head.id;
        const sql = relation.table
          ? `NOT EXISTS(SELECT 1 FROM ${quote(relation.table)} WHERE target_value = ?${self ? " AND source_id <> ?" : ""})`
          : `NOT EXISTS(SELECT 1 FROM ${quote(manifest.table)} WHERE ${bindingExpression(sourceBinding)} = ?${self ? " AND id <> ?" : ""})`;
        const values = self ? [String(value), String(record.id)] : [String(value)];
        if (
          !(await this.db
            .prepare(`SELECT 1 WHERE ${sql}`)
            .bind(...values)
            .first())
        )
          forbidden("记录仍被关系引用，无法删除");
        assertions.push({ sql, values });
      }
    }
    return assertions;
  }
  async create(id: string, input: unknown): Promise<RecordValue> {
    return this.write(id, "create", undefined, recordInput(input));
  }
  async update(id: string, recordId: string, input: unknown): Promise<RecordValue> {
    return this.write(id, "update", recordId, recordInput(input));
  }
  private async write(
    id: string,
    operation: "create" | "update" | "delete",
    recordId?: string,
    input: RecordValue = {},
  ): Promise<RecordValue> {
    const model = await this.model(id);
    const previousRow = recordId ? await readRow(this.db, model, recordId) : null;
    if (operation !== "create" && !previousRow) notFound("记录不存在");
    const previous = previousRow ? await withRelations(this.db, model, previousRow) : undefined;
    const access = requireAccess(model, this.actor, operation, previous);
    if (
      Object.hasOwn(input, "id") &&
      (typeof input.id !== "string" || !input.id || (recordId && input.id !== recordId))
    )
      invalid("记录 id 必须非空并匹配路由");
    for (const key of Object.keys(input)) {
      if (metadata.has(key)) {
        if (key !== "id" && input[key] !== previous?.[key]) forbidden("服务端身份字段不可提交");
        continue;
      }
      if (!access.fields.has(key)) forbidden(`没有提交字段 ${key} 的权限`);
      const schema = model.definition.document.data.properties[key];
      if (!schema) invalid(`未声明字段 ${key}`);
      if (
        resolveSchema(schema, model.definition.document.data).readOnly &&
        input[key] !== previous?.[key]
      )
        forbidden(`字段 ${key} 只读`);
    }
    const generatedId = recordId ?? (typeof input.id === "string" ? input.id : crypto.randomUUID());
    const now = new Date().toISOString();
    let record: RecordValue = {
      ...(previous ?? (applyDefaults(model.definition.document.data, {}) as RecordValue)),
      ...input,
      id: generatedId,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      creatorId: previous?.creatorId ?? this.actor.id,
    };
    record = await prepareAndValidate(this.db, model, this.actor, operation, record, previous);
    if (operation !== "delete") {
      const data = Object.fromEntries(
        Object.entries(record).filter(([key]) =>
          Object.hasOwn(model.definition.document.data.properties, key),
        ),
      );
      const issues = validateValue(model.definition.document.data, data);
      if (issues.length)
        throw new ServiceError("INVALID_VALUE", "记录不符合当前已发布 schema", 422, issues);
    }
    const assertions = await systemAssertions(this.db, model, operation, record);
    assertions.push(
      ...(operation === "delete"
        ? await this.deletionAssertions(model, record)
        : await this.relationAssertions(model, record, input)),
    );
    if (previousRow)
      assertions.push({
        sql: `EXISTS(SELECT 1 FROM ${quote(model.manifest.table)} WHERE id = ? AND updated_at = ? AND data_content = ?)`,
        values: [generatedId, previousRow.updated_at, previousRow.data_content],
      });
    const guards = [
      transactionGuard(
        this.db,
        "EXISTS(SELECT 1 FROM fw_models WHERE id = ? AND active_version = ?)",
        [id, model.version],
      ),
      ...assertions.map((assertion) => transactionGuard(this.db, assertion.sql, assertion.values)),
    ];
    const statements: D1PreparedStatement[] = guards.map((guard) => guard.first);
    const physical = model.definition.backend.storage.bindings.filter(
      (binding) =>
        binding.column &&
        !["id", "created_at", "updated_at", "creator_id", "data_content"].includes(binding.column),
    );
    if (operation === "delete")
      statements.push(
        this.db
          .prepare(`DELETE FROM ${quote(model.manifest.table)} WHERE id = ?`)
          .bind(generatedId),
      );
    else if (operation === "create") {
      const columns = [
        "id",
        "created_at",
        "updated_at",
        "creator_id",
        "data_content",
        ...physical.map((binding) => binding.column!),
      ];
      statements.push(
        this.db
          .prepare(
            `INSERT INTO ${quote(model.manifest.table)} (${columns.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
          )
          .bind(
            generatedId,
            now,
            now,
            this.actor.id,
            mergeContent(model, record),
            ...physical.map((binding) => encodeValue(binding, record[bindingKey(binding)])),
          ),
      );
    } else {
      const columns = ["updated_at", "data_content", ...physical.map((binding) => binding.column!)];
      statements.push(
        this.db
          .prepare(
            `UPDATE ${quote(model.manifest.table)} SET ${columns.map((column) => `${quote(column)} = ?`).join(", ")} WHERE id = ?`,
          )
          .bind(
            now,
            mergeContent(model, record, previousRow!),
            ...physical.map((binding) => encodeValue(binding, record[bindingKey(binding)])),
            generatedId,
          ),
      );
    }
    for (const relation of model.manifest.relations.filter((item) => item.active && item.table)) {
      statements.push(
        this.db
          .prepare(`DELETE FROM ${quote(relation.table!)} WHERE source_id = ?`)
          .bind(generatedId),
      );
      if (operation !== "delete") {
        const binding = model.definition.backend.storage.bindings.find(
          (item) => item.id === relation.fieldId,
        )!;
        const values = record[bindingKey(binding)] as string[];
        for (const value of new Set(values))
          statements.push(
            this.db
              .prepare(
                `INSERT INTO ${quote(relation.table!)}(source_id, target_value) VALUES (?, ?)`,
              )
              .bind(generatedId, value),
          );
      }
    }
    statements.push(
      ...outboxStatements(this.db, model, operation, record),
      ...guards.map((guard) => guard.last),
    );
    try {
      await this.db.batch(statements);
    } catch (error) {
      if ((await readHead(this.db, id))?.active_version !== model.version)
        throw new ServiceError("SCHEMA_CHANGED", "提交期间模型已发布新版本，请重新提交", 409);
      if (operation === "create" && (await readRow(this.db, model, generatedId)))
        throw new ServiceError("REVISION_CONFLICT", "记录 id 已存在", 409);
      if (error instanceof Error && /fw_commit_guards|CHECK constraint/iu.test(error.message))
        throw new ServiceError("REVISION_CONFLICT", "记录或关联数据已改变，请重新读取", 409);
      throw new ServiceError("INVALID_VALUE", "记录存储约束校验失败", 422, [
        {
          path: "",
          code: "STORAGE_CONSTRAINT",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
    return projectRecord(
      record,
      accessFor(model, this.actor, "read").allowed ? accessFor(model, this.actor, "read") : access,
    );
  }
  async delete(id: string, recordId: string) {
    await this.write(id, "delete", recordId);
    return { deleted: true as const };
  }
  async batchDelete(id: string, input: unknown) {
    const body = z.object({ ids: idsSchema }).strict().parse(input);
    // Each record has a guarded transaction and explicit per-record result.
    const deleted: string[] = [],
      failed: { id: string; code: string; message: string }[] = [];
    for (const recordId of new Set(body.ids)) {
      try {
        await this.delete(id, recordId);
        deleted.push(recordId);
      } catch (error) {
        if (!(error instanceof ServiceError)) throw error;
        failed.push({ id: recordId, code: error.code, message: error.message });
      }
    }
    return { deleted, failed };
  }
  async subtree(id: string, input: unknown) {
    const body = z
      .object({
        idField: z.string().default("id"),
        parentField: z.string(),
        parentValue: z.string().optional(),
      })
      .strict()
      .parse(input);
    const model = await this.model(id),
      access = requireAccess(model, this.actor, "read");
    const relation = model.definition.backend.relations.find(
      (item) => item.kind === "many-to-one" && item.targetModel === id,
    );
    const binding =
      relation &&
      model.definition.backend.storage.bindings.find((item) => item.id === relation.fieldId);
    if (body.idField !== "id" || !binding || bindingKey(binding) !== body.parentField)
      invalid("子树字段必须匹配 backend 父级关系");
    if (!access.fields.has(body.parentField)) forbidden();
    const table = quote(model.manifest.table);
    const own = access.scope === "own";
    const parentExpression = bindingExpression(binding);
    const recursiveParent = binding.column
      ? `r.${quote(binding.column)}`
      : parentExpression.replace('"data_content"', 'r."data_content"');
    const rows = body.parentValue
      ? await this.db
          .prepare(
            `WITH RECURSIVE descendants(id) AS (
        SELECT id FROM ${table} WHERE ${parentExpression} = ?${own ? " AND creator_id = ?" : ""}
        UNION SELECT r.id FROM ${table} r JOIN descendants d ON ${recursiveParent} = d.id${own ? " WHERE r.creator_id = ?" : ""}
       ) SELECT r.* FROM ${table} r JOIN descendants d ON r.id = d.id WHERE r.id <> ?`,
          )
          .bind(body.parentValue, ...(own ? [this.actor.id, this.actor.id] : []), body.parentValue)
          .all<PhysicalRow>()
      : await this.db
          .prepare(`SELECT * FROM ${table}${own ? " WHERE creator_id = ?" : ""}`)
          .bind(...(own ? [this.actor.id] : []))
          .all<PhysicalRow>();
    const output: RecordValue[] = [];
    for (const row of rows.results)
      output.push(projectRecord(await withRelations(this.db, model, row), access));
    return output;
  }
  async options(id: string, input: unknown) {
    const body = z
      .object({
        fieldId: z.string(),
        keyword: z.string().optional(),
        selectedValues: z.array(z.string()).max(200).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .strict()
      .parse(input);
    const source = await this.model(id),
      sourceAccess = requireAccess(source, this.actor, "read");
    const relation = source.definition.backend.relations.find(
      (item) => item.fieldId === body.fieldId,
    );
    const binding = source.definition.backend.storage.bindings.find(
      (item) => item.id === body.fieldId,
    );
    if (!relation || !binding) invalid("未知关系 fieldId");
    if (!sourceAccess.fields.has(bindingKey(binding))) forbidden();
    const target = await this.model(relation.targetModel),
      targetAccess = requireAccess(target, this.actor, "read");
    const targetBinding = target.definition.backend.storage.bindings.find(
      (item) => item.id === relation.targetFieldId,
    );
    if (targetBinding && !targetAccess.fields.has(bindingKey(targetBinding))) forbidden();
    const labelKey = [
      "name",
      "title",
      "username",
      ...Object.keys(target.definition.document.data.properties),
    ].find(
      (key) =>
        targetAccess.fields.has(key) &&
        schemaType(
          resolveSchema(
            target.definition.document.data.properties[key]!,
            target.definition.document.data,
          ),
        ) === "string",
    );
    const table = quote(target.manifest.table);
    const labelBinding = target.definition.backend.storage.bindings.find(
      (item) => bindingKey(item) === labelKey,
    );
    const labelExpression = labelBinding ? bindingExpression(labelBinding) : '"id"';
    const valueExpression = targetBinding ? bindingExpression(targetBinding) : '"id"';
    const own = targetAccess.scope === "own";
    const base = own ? "creator_id = ?" : "1";
    const args = own ? [this.actor.id] : [];
    const search = `${base}${body.keyword ? ` AND instr(${labelExpression}, ?) > 0` : ""}`;
    const searchArgs = [...args, ...(body.keyword ? [body.keyword] : [])];
    const [count, rows] = await this.db.batch([
      this.db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE ${search}`).bind(...searchArgs),
      this.db
        .prepare(`SELECT * FROM ${table} WHERE ${search} ORDER BY ${labelExpression}, id LIMIT ?`)
        .bind(...searchArgs, body.limit),
    ]);
    const selected = [...new Set(body.selectedValues)],
      selectedRows: PhysicalRow[] = [];
    for (let offset = 0; offset < selected.length; offset += 80) {
      const values = selected.slice(offset, offset + 80);
      selectedRows.push(
        ...(
          await this.db
            .prepare(
              `SELECT * FROM ${table} WHERE ${base} AND ${valueExpression} IN (${values.map(() => "?").join(", ")})`,
            )
            .bind(...args, ...values)
            .all<PhysicalRow>()
        ).results,
      );
    }
    const records: RecordValue[] = [];
    const seen = new Set<string>();
    for (const row of [...selectedRows, ...(rows.results as PhysicalRow[])]) {
      if (seen.has(row.id) || records.length >= 200) continue;
      seen.add(row.id);
      records.push(await withRelations(this.db, target, row));
    }
    return {
      options: records.map((record) => ({
        value: record[targetBinding ? bindingKey(targetBinding) : "id"],
        label: String(record[labelKey ?? "id"]),
      })),
      total: Number((count.results[0] as { total: number }).total),
    };
  }
  async command(id: string, command: string, input: JsonValue): Promise<JsonValue> {
    const model = await this.model(id);
    const handler = model.definition.backend.behavior.commands[command];
    if (handler !== "records.count") notFound("命令未注册");
    requireAccess(model, this.actor, "read");
    const query = z
      .object({ filters: z.record(z.string(), z.json()).default({}) })
      .strict()
      .parse(input);
    const result = await this.query(id, { ...query, page: 1, pageSize: 1 });
    return { count: result.total };
  }
}
