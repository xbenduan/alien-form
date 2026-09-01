import {
  formProperties,
  type ColumnType,
  type ModelFieldSchema,
  type ModelSchema,
} from "./types.ts";
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

function isMultiValue(field: ModelFieldSchema): boolean {
  const selectMode = (field.props as { selectMode?: unknown } | undefined)?.selectMode;
  return field.component === "Select" && (selectMode === "multiple" || selectMode === "tags");
}

/** 推导列类型：x-database.type 优先，否则由 type/component 派生。 */
function inferColumnType(field: ModelFieldSchema): ColumnType {
  const explicit = field["x-database"]?.type;
  if (explicit) return explicit;

  if (field.properties || (field.items && !Array.isArray(field.items))) return "json";
  if (isMultiValue(field)) return "json";
  if (field.type === "number" || field.component === "NumberInput") {
    return "real";
  }
  if (field.type === "boolean") return "boolean";
  return "text";
}

/**
 * 把一份 schema 的所有字段解析为存储计划。
 * 每个字段产出一个 ColumnPlan（含 many-to-one 标量外键）或 RelationPlan（m2m）。
 */
export function planFields(schema: ModelSchema): FieldPlan[] {
  const owner = schema.meta.name;
  const plans: FieldPlan[] = [];

  for (const [key, field] of Object.entries(formProperties(schema))) {
    if (SYSTEM_MANAGED.has(key)) continue;

    const xdb = field["x-database"] ?? {};
    const relation = xdb.relation;
    const target = xdb.target;

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

/**
 * 引用字段声明：读路径把标量 join 键展开成 { $ref, value, label } 所需的元信息。
 * 由既有的 canonical 声明派生（不额外要求作者重复配置）：
 *  - props.service（字段运行时取数声明）：model/valueKey/labelKey；
 *  - TreeSelect 的 props（自连接业务码软引用，如 deptCode/parentCode）：取 treeModel/treeIdField/treeLabelField；
 *  - 显式 x-ref（可选，未来直接声明）：{ model, value?, label? }。
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

/** 显式 x-ref 声明（可选）。 */
interface XRefMeta {
  model: string;
  value?: string;
  label?: string;
}

interface FieldServiceMeta {
  model: string;
  valueKey?: string;
  labelKey?: string;
}

/** 扫描一份 schema 的所有引用字段。 */
export function refFields(schema: ModelSchema): RefField[] {
  const refs: RefField[] = [];
  for (const [key, field] of Object.entries(formProperties(schema))) {
    if (SYSTEM_MANAGED.has(key)) continue;
    const multi = isMultiValue(field);

    // 1) 显式 x-ref
    const xref = field["x-ref"] as XRefMeta | undefined;
    if (xref && typeof xref.model === "string") {
      const value = typeof xref.value === "string" ? xref.value : "id";
      refs.push({
        field: key,
        model: xref.model,
        valueKey: value,
        labelKey: typeof xref.label === "string" ? xref.label : value,
        multi,
      });
      continue;
    }

    // 2) props.service（字段组件声明的远程取数）
    const service = (field.props as { service?: unknown } | undefined)?.service as
      | FieldServiceMeta
      | undefined;
    if (service && typeof service.model === "string") {
      const value = typeof service.valueKey === "string" ? service.valueKey : "id";
      refs.push({
        field: key,
        model: service.model,
        valueKey: value,
        labelKey: typeof service.labelKey === "string" ? service.labelKey : value,
        multi,
      });
      continue;
    }

    // 3) TreeSelect props（自连接业务码软引用）
    if (field.component === "TreeSelect") {
      const props = (field.props ?? {}) as Record<string, unknown>;
      const treeModel = typeof props.treeModel === "string" ? props.treeModel : "";
      if (!treeModel) continue;
      const idField = typeof props.treeIdField === "string" ? props.treeIdField : "id";
      refs.push({
        field: key,
        model: treeModel,
        valueKey: idField,
        labelKey: typeof props.treeLabelField === "string" ? props.treeLabelField : idField,
        multi: false,
      });
    }
  }
  return refs;
}
