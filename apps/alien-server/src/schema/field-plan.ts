import { databaseFields, type ColumnType, type ModelSchema } from "./types.ts";
import { junctionName, tableName, toSnake } from "./naming.ts";

/** id / createdAt / updatedAt 由仓储统一管理为系统列，不从 schema 字段建列。 */
export const SYSTEM_MANAGED = new Set(["id", "createdAt", "updatedAt"]);

/** 普通标量/JSON 列的存储计划。 */
export interface ColumnPlan {
  kind: "column";
  /** schema 字段名（camelCase）。 */
  field: string;
  /** 物理列名（snake_case）。 */
  column: string;
  type: ColumnType;
  nullable: boolean;
  default?: string | number | boolean;
  unique: boolean;
  index: boolean;
  /** JSON 列：写入时序列化、读取时反序列化。 */
  json: boolean;
  filterable: boolean;
  sortable: boolean;
  /** many-to-one：值为目标记录 id 的标量外键。 */
  relationTarget?: string;
}

/** 多对多关系的存储计划（junction 表）。 */
export interface RelationPlan {
  kind: "m2m";
  field: string;
  through: string;
  ownerColumn: string;
  targetColumn: string;
  target: string;
}

export type FieldPlan = ColumnPlan | RelationPlan;

/**
 * 把 database.fields 解析为存储计划。
 * 每个字段产出一个 ColumnPlan（含 many-to-one 标量外键）或 RelationPlan（m2m）。
 */
export function planFields(schema: ModelSchema): FieldPlan[] {
  const owner = schema.meta.name;
  const plans: FieldPlan[] = [];

  for (const [key, field] of Object.entries(databaseFields(schema))) {
    if (SYSTEM_MANAGED.has(key)) continue;

    const relation = field.relation;

    if (relation?.kind === "many-to-many") {
      plans.push({
        kind: "m2m",
        field: key,
        through: relation.through ?? junctionName(owner, relation.target, key),
        ownerColumn: `${tableName(owner)}_id`,
        targetColumn: `${tableName(relation.target)}_id`,
        target: relation.target,
      });
      continue;
    }

    const json = field.type === "json";
    const index = field.index ?? false;
    plans.push({
      kind: "column",
      field: key,
      column: field.column ?? toSnake(key),
      type: field.type,
      nullable: field.nullable ?? true,
      default: field.default,
      unique: field.unique ?? false,
      index,
      json,
      filterable: json ? false : (field.filterable ?? index),
      sortable: field.sortable ?? !json,
      relationTarget: relation?.kind === "many-to-one" ? relation.target : undefined,
    });
  }

  return plans;
}

/** 便捷：按 field 名索引 plan。 */
export function planByField(schema: ModelSchema): Map<string, FieldPlan> {
  const map = new Map<string, FieldPlan>();
  for (const plan of planFields(schema)) map.set(plan.field, plan);
  return map;
}

/**
 * 引用字段声明：完全来自 database.fields.relation。
 */
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

/** 扫描一份 schema 的所有引用字段。 */
export function refFields(schema: ModelSchema): RefField[] {
  const refs: RefField[] = [];
  for (const [key, field] of Object.entries(databaseFields(schema))) {
    if (SYSTEM_MANAGED.has(key)) continue;
    const relation = field.relation;
    if (!relation) continue;
    const valueKey = relation.valueField ?? "id";
    refs.push({
      field: key,
      model: relation.target,
      valueKey,
      labelKey: relation.labelField ?? valueKey,
      multi: relation.kind === "many-to-many" || field.valueType === "array",
    });
  }
  return refs;
}
