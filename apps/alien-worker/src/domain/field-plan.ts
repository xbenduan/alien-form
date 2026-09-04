import { databaseFields } from "@alien-form/validate";
import type { DatabaseColumnType, BuilderSchema as ModelSchema } from "@alien-form/validate";

/** id / createdAt / updatedAt 由仓储统一托管为系统列，不参与字段计划。 */
export const SYSTEM_MANAGED = new Set(["id", "createdAt", "updatedAt"]);

/**
 * 字段查询计划：可用于 WHERE / ORDER BY 的字段元信息。
 *
 * D1 通用两表设计下没有「一模型一物理表」，业务字段一律落在 records.data_content
 * JSON 里，靠 json_extract 取值。因此计划里不含物理列名 / DDL / junction 表 ——
 * 那些都是 Node 版专属的死代码，这里一并砍掉。
 */
export interface FieldPlan {
  /** schema 字段名（camelCase），也是 json_extract 的 key。 */
  field: string;
  type: DatabaseColumnType;
  /** JSON 值（object/array）：不可过滤。 */
  json: boolean;
  filterable: boolean;
  sortable: boolean;
}

/** 引用字段声明：完全来自 database.fields.relation。 */
export interface RefField {
  /** 本模型字段名。 */
  field: string;
  /** 目标模型 modelCode。 */
  model: string;
  /** 目标模型上的 join 键（回写用原值，如 id / deptCode）。 */
  valueKey: string;
  /** 目标模型上的展示字段（如 displayName / deptName）。 */
  labelKey: string;
  /** 数组值（many-to-many / 多值组件），展开为 ref 对象数组。 */
  multi: boolean;
}

/**
 * 把 fields 解析为查询计划。系统字段与多对多字段不产出计划：
 *  - 系统字段由仓储托管为独立列；
 *  - 多对多以 JSON 数组落在 data_content，不作为可过滤 / 排序列（仍可被 ref 展开）。
 */
export function planFields(schema: ModelSchema): FieldPlan[] {
  const plans: FieldPlan[] = [];
  for (const field of databaseFields(schema)) {
    if (field.system || SYSTEM_MANAGED.has(field.key)) continue;
    if (field.relation?.kind === "many-to-many") continue;
    const json = field.type === "json";
    const index = field.index ?? false;
    plans.push({
      field: field.key,
      type: field.type,
      json,
      filterable: json ? false : (field.filterable ?? index),
      sortable: field.sortable ?? !json,
    });
  }
  return plans;
}

/** 便捷：按 field 名索引 plan。 */
export function planByField(schema: ModelSchema): Map<string, FieldPlan> {
  return new Map(planFields(schema).map((plan) => [plan.field, plan]));
}

/** 扫描一份 schema 的所有引用字段（供 ref 展开使用）。 */
export function refFields(schema: ModelSchema): RefField[] {
  const refs: RefField[] = [];
  for (const field of databaseFields(schema)) {
    if (field.system || SYSTEM_MANAGED.has(field.key)) continue;
    const relation = field.relation;
    if (!relation) continue;
    const valueKey = relation.valueField ?? "id";
    refs.push({
      field: field.key,
      model: relation.target,
      valueKey,
      labelKey: relation.labelField ?? valueKey,
      multi: relation.kind === "many-to-many" || field.valueType === "array",
    });
  }
  return refs;
}
