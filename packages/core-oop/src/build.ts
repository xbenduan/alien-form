import { startBatch, endBatch } from "alien-signals";
import {
  type IFieldSchema,
  type IFormSchema,
  type RuntimeContext,
  type SchemaRule,
  kindOf,
} from "./schema";
import {
  ArrayField,
  Field,
  ObjectField,
  PrimitiveField,
  Row,
  VoidField,
} from "./field/field";
import { executeRule } from "./runtime/rule";
import { hasRequired } from "./runtime/validate";

/** 由 build 注入到字段的运行时上下文工厂（self 绑定），供 format 求值使用。 */
export type ContextFactory = (self: Field) => RuntimeContext;

/**
 * 依据一个字段 schema 构造对应 Field 实例（不含子树填充）。
 * 同时依据 x-validators 是否含 required 点亮 required signal。
 */
function createField(
  key: string,
  schema: IFieldSchema,
  parent?: Field,
  row?: Row,
): Field {
  const kind = kindOf(schema);
  let field: Field;
  switch (kind) {
    case "object":
      field = new ObjectField(key, schema, parent, row);
      break;
    case "array":
      field = new ArrayField(key, schema, parent, row);
      break;
    case "void":
      field = new VoidField(key, schema, parent, row);
      break;
    default:
      field = new PrimitiveField(key, schema, parent, row);
  }
  if (hasRequired(schema["x-validators"])) field.required(true);
  return field;
}

/**
 * 对叶子字段应用 x-format.input（外→内），返回转换后的值。
 * 无 format 时原样返回。
 */
function applyInputFormat(
  field: Field,
  value: any,
  makeCtx: ContextFactory,
): any {
  const input = field.schema["x-format"]?.input;
  if (input === undefined) return value;
  return executeRule(input as SchemaRule, makeCtx(field), "formats", value);
}

/**
 * 递归填充容器字段的子树，并按 initialValues 派发到各叶子（叶子跑 input-format）。
 * object / void 走 properties；array 依据初始值数组长度生成 Row 并配置行构造器。
 */
function buildChildren(
  container: ObjectField | VoidField,
  init: Record<string, any> | undefined,
  makeCtx: ContextFactory,
): void {
  const props = container.schema.properties ?? {};
  for (const [key, childSchema] of Object.entries(props)) {
    const child = createField(key, childSchema, container);
    container.children.set(key, child);
    populate(child, init?.[key], makeCtx);
  }
}

/**
 * 为数组字段配置行构造器（buildRow），并按初始值生成初始行。
 * 每行是一棵以 items schema 为模板的子树。
 */
function setupArray(
  field: ArrayField,
  init: any,
  makeCtx: ContextFactory,
): void {
  const itemSchema = field.schema.items;
  /** 用 items schema 填充一行的子字段，并派发该行初始值。 */
  field.buildRow = (row: Row, rowInit?: any) => {
    if (!itemSchema) return;
    // items 顶层即一个匿名对象结构：其 properties 展开为行的直接子字段。
    const props = itemSchema.properties ?? {};
    for (const [key, childSchema] of Object.entries(props)) {
      const child = createField(key, childSchema, field, row);
      row.children.set(key, child);
      populate(child, rowInit?.[key], makeCtx);
    }
  };
  field.setRows(Array.isArray(init) ? init : []);
}

/**
 * 递归填充单个字段的值 / 子树：
 * primitive → 跑 input-format 后 setValue；object/void → buildChildren；array → setupArray。
 */
function populate(field: Field, init: any, makeCtx: ContextFactory): void {
  if (field instanceof PrimitiveField) {
    const raw = init !== undefined ? init : field.schema.default;
    field.setValue(applyInputFormat(field, raw, makeCtx));
  } else if (field instanceof ArrayField) {
    setupArray(field, init !== undefined ? init : field.schema.default, makeCtx);
  } else if (field instanceof ObjectField || field instanceof VoidField) {
    buildChildren(field, init, makeCtx);
  }
}

/**
 * 从表单 schema 构建根字段树并注入 initialValues（在一个 batch 内下发）。
 * 返回根 ObjectField。
 */
export function buildTree(
  schema: IFormSchema,
  initialValues: Record<string, any> | undefined,
  makeCtx: ContextFactory,
): ObjectField {
  const root = new ObjectField("", schema as IFieldSchema);
  startBatch();
  try {
    buildChildren(root, initialValues, makeCtx);
  } finally {
    endBatch();
  }
  return root;
}
