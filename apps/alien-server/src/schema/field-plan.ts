import type { ColumnType, ModelFieldSchema, ModelSchema } from "./types.ts";
import { isPluginMarker } from "./types.ts";
import { junctionName, tableName, toSnake } from "./naming.ts";

/** 值为数组的多值组件：无关系时落 JSON 列，有关系时落 junction。 */
const MULTI_VALUE_COMPONENTS = new Set(["MultiSelect", "TagsInput", "CheckboxGroup"]);

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

function isMultiValue(field: ModelFieldSchema): boolean {
  return field.component ? MULTI_VALUE_COMPONENTS.has(field.component) : false;
}

/** dataSource 是否为 $af-dataSource 关联 marker，返回目标模型。 */
function relationTargetFromDataSource(field: ModelFieldSchema): string | undefined {
  const ds = field.dataSource;
  if (isPluginMarker(ds) && ds.plugin === "$af-dataSource" && typeof ds.model === "string") {
    return ds.model;
  }
  return undefined;
}

/** 推导列类型：x-database.type 优先，否则由 type/component 派生。 */
function inferColumnType(field: ModelFieldSchema): ColumnType {
  const explicit = field["x-database"]?.type;
  if (explicit) return explicit;

  if (field.properties || (field.items && !Array.isArray(field.items))) return "json";
  if (isMultiValue(field)) return "json";
  if (field.type === "number" || field.component === "NumberInput" || field.component === "Rate") {
    return "real";
  }
  if (field.type === "boolean" || field.component === "Switch") return "boolean";
  return "text";
}

/**
 * 把一份 schema 的所有字段解析为存储计划。
 * 每个字段产出一个 ColumnPlan（含 many-to-one 标量外键）或 RelationPlan（m2m）。
 */
export function planFields(schema: ModelSchema): FieldPlan[] {
  const owner = schema.meta.name;
  const plans: FieldPlan[] = [];

  for (const [key, field] of Object.entries(schema.properties ?? {})) {
    if (SYSTEM_MANAGED.has(key)) continue;

    const xdb = field["x-database"] ?? {};
    const dsTarget = relationTargetFromDataSource(field);
    const multi = isMultiValue(field);
    const relation =
      xdb.relation ?? (dsTarget ? (multi ? "many-to-many" : "many-to-one") : undefined);
    const target = xdb.target ?? dsTarget;

    // 多对多：junction 表，不在主表建列
    if (relation === "many-to-many" && target) {
      plans.push({
        kind: "m2m",
        field: key,
        through: xdb.through ?? junctionName(owner, target, key),
        ownerColumn: `${tableName(owner)}_id`,
        targetColumn: `${tableName(target)}_id`,
        target,
      });
      continue;
    }

    const type = inferColumnType(field);
    const json = type === "json";
    const index = xdb.index ?? false;
    plans.push({
      kind: "column",
      field: key,
      column: toSnake(key),
      type,
      nullable: xdb.nullable ?? !field.required,
      default: xdb.default,
      unique: xdb.unique ?? false,
      index,
      json,
      // 可筛选 ⟺ 声明 filterable，缺省跟随 index；JSON 列不可筛选
      filterable: json ? false : (xdb.filterable ?? index),
      // 可排序：缺省标量列可排序，JSON 列不可
      sortable: xdb.sortable ?? !json,
      relationTarget: relation === "many-to-one" ? target : undefined,
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
