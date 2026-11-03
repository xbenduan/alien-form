import { pointerSegments, queryClauseIssues, resolveModel } from "formwork/model";
import type { RecordQuery, StorageBinding } from "formwork/model";
import type { Actor, StoredModel } from "../../../contracts";
import { recordCapabilities } from "../../../application/auth/access";
import type { Access } from "../../../application/auth/access";
import { modelContract } from "../../../../../../packages/domain-contracts";
import { forbidden, invalid, ServiceError } from "../../../http/errors";
import { bindingExpression, bindingExistsExpression } from "./storage";
import { encodeValue } from "../repositories/values";

/** 按授权能力取查询绑定，使用 Pointer 而非物理列名。 */
export function queryBinding(
  model: StoredModel,
  actor: Actor,
  pointer: string,
  operation: "filter" | "sort",
): StorageBinding {
  const capability = recordCapabilities(model, actor).fields[pointer];
  if (!capability?.read || (operation === "sort" ? !capability.sort : !capability.filter.length))
    forbidden("字段不允许用于此查询");
  const binding = model.definition.backend.storage.bindings.find((item) => item.path === pointer);
  if (!binding) invalid(`未知字段 ${pointer}`);
  return binding;
}

/** 将已授权的 clauses 编译为参数化 D1 条件，保留 false、0、空串与 null 的区别。 */
export function predicates(model: StoredModel, actor: Actor, access: Access, query: RecordQuery) {
  const sql: string[] = [];
  const values: (string | number | null)[] = [];
  const capabilities = recordCapabilities(model, actor);
  const resolved = resolveModel(
    {
      ...model.definition.schema,
      data: Object.fromEntries(
        model.definition.backend.storage.bindings.map((binding) => [
          pointerSegments(binding.path)[0]!,
          model.definition.schema.data[pointerSegments(binding.path)[0]!] ?? {
            type: "string",
            readOnly: true,
          },
        ]),
      ),
    },
    modelContract(model.definition.schema),
  );
  if (access.scope === "own") {
    sql.push('"creator_id" = ?');
    values.push(actor.id);
  }
  const clauses = [...query.clauses];
  if (query.parentId !== undefined) {
    const pointer = model.definition.schema.tree?.parentField;
    if (!pointer) invalid("模型未声明 tree.parentField");
    clauses.push({ field: pointer, operator: "eq", operand: query.parentId });
  }
  for (const clause of clauses) {
    const binding = queryBinding(model, actor, clause.field, "filter");
    const field = resolved.field(clause.field).schema;
    const issues = queryClauseIssues(field, capabilities.fields[clause.field]!.filter, clause);
    if (issues.length) throw new ServiceError("INVALID_QUERY", "查询条件无效", 422, issues);
    const expression = bindingExpression(binding);
    const exists = bindingExistsExpression(binding);
    const operand = clause.operand;
    switch (clause.operator) {
      case "isNull":
      case "isNotNull":
        sql.push(
          `(${exists} AND ${expression} IS ${clause.operator === "isNotNull" ? "NOT " : ""}NULL)`,
        );
        break;
      case "eq":
        sql.push(`${expression} = ?`);
        values.push(encodeValue(binding, operand));
        break;
      case "contains":
        sql.push(`instr(${expression}, ?) > 0`);
        values.push(String(operand));
        break;
      case "between": {
        const range = operand as number[];
        sql.push(`${expression} BETWEEN ? AND ?`);
        values.push(range[0]!, range[1]!);
        break;
      }
      case "in": {
        const members = operand as (string | number | boolean)[];
        if (members.length > 100) invalid("in 最多支持 100 个候选值");
        const placeholders = members.map(() => "?").join(", ");
        sql.push(
          field.type === "array"
            ? `EXISTS(SELECT 1 FROM json_each(${expression}) AS member WHERE member.value IN (${placeholders}))`
            : `${expression} IN (${placeholders})`,
        );
        values.push(
          ...members.map((value) => (typeof value === "boolean" ? Number(value) : value)),
        );
        break;
      }
    }
  }
  if (query.keyword !== undefined) {
    const fields = resolved.fields.filter((field) =>
      capabilities.fields[field.path]?.filter.includes("contains"),
    );
    sql.push(
      fields.length
        ? `(${fields.map((field) => `instr(${bindingExpression(queryBinding(model, actor, field.path, "filter"))}, ?) > 0`).join(" OR ")})`
        : "0",
    );
    values.push(...fields.map(() => query.keyword!));
  }
  return { sql: sql.length ? `WHERE ${sql.join(" AND ")}` : "", values };
}
