import { computed, effectScope, signal, startBatch, endBatch } from "alien-signals";
import {
  type FieldError,
  type Handlers,
  type IFormSchema,
  type RuntimeContext,
  type SchemaRule,
} from "./schema";
import {
  ArrayField,
  Field,
  ObjectField,
  PrimitiveField,
  VoidField,
} from "./field/field";
import { createContext, resolveField } from "./runtime/context";
import { executeRule } from "./runtime/rule";
import { buildTree } from "./build";

/** createForm 配置。 */
export interface FormConfig {
  schema: IFormSchema;
  initialValues?: Record<string, any>;
  scope?: Record<string, any>;
  handlers?: Handlers;
  onError?: (e: unknown) => void;
}

/**
 * 遍历字段树跑 output-format（内→外），组合出对外提交值。
 * 与 composeChildren 同构：跳过 display:none，void 摊平；primitive 跑 x-format.output。
 */
function formatOut(
  field: Field,
  makeCtx: (self: Field) => RuntimeContext,
): any {
  if (field instanceof PrimitiveField) {
    const output = field.schema["x-format"]?.output;
    const v = field.value();
    return output === undefined
      ? v
      : executeRule(output as SchemaRule, makeCtx(field), "formats", v);
  }
  if (field instanceof ArrayField) {
    return field.rows().map((row) => {
      const out: Record<string, any> = {};
      for (const c of row.children.values()) {
        if (c.display() === "none") continue;
        out[c.key] = formatOut(c, makeCtx);
      }
      return out;
    });
  }
  // object / void
  const container = field as ObjectField | VoidField;
  const out: Record<string, any> = {};
  const ordered = [...container.children.values()].sort(
    (a, b) => (a.schema.order ?? 0) - (b.schema.order ?? 0),
  );
  for (const c of ordered) {
    if (c.display() === "none") continue;
    if (c.kind === "void") Object.assign(out, formatOut(c, makeCtx));
    else out[c.key] = formatOut(c, makeCtx);
  }
  return out;
}

/**
 * 遍历字段树收集所有 display!==none 叶子/字段，用于并发校验。
 */
function collectFields(field: Field, acc: Field[]): void {
  if (field.display() === "none") return;
  acc.push(field);
  if (field instanceof ObjectField || field instanceof VoidField) {
    for (const c of field.children.values()) collectFields(c, acc);
  } else if (field instanceof ArrayField) {
    for (const row of field.rows())
      for (const c of row.children.values()) collectFields(c, acc);
  }
}

/**
 * Form：编译后的响应式表单实例。构建与 mount 分离，便于 SSR / 受控。
 */
export class Form {
  /** 根字段。 */
  readonly root: ObjectField;
  /** 表单值（= root.value，内部值，未跑 output-format）。 */
  readonly values: () => Record<string, any>;
  /** 全表单错误聚合。 */
  readonly errors: () => FieldError[];
  /** 是否无错误。 */
  readonly valid: () => boolean;
  /** 提交中标记。 */
  readonly submitting = signal(false);

  private readonly handlers: Handlers;
  private readonly userScope: Record<string, any>;
  private readonly onError: (e: unknown) => void;
  private rootScope?: () => void;
  private mounted = false;

  /**
   * 组装表单：构建字段树、注入初始值、准备 values/errors/valid 计算属性。
   */
  constructor(config: FormConfig) {
    this.handlers = config.handlers ?? {};
    this.userScope = config.scope ?? {};
    this.onError = config.onError ?? ((e) => console.error(e));
    const makeCtx = this.makeContext.bind(this);
    this.root = buildTree(config.schema, config.initialValues, makeCtx);
    this.values = this.root.value;
    this.errors = computed(() => {
      const acc: Field[] = [];
      collectFields(this.root, acc);
      return acc.flatMap((f) => f.errors());
    });
    this.valid = computed(() => this.errors().length === 0);
  }

  /** 为某字段构造绑定的 RuntimeContext。 */
  private makeContext(self: Field): RuntimeContext {
    return createContext({
      root: this.root,
      self,
      userScope: this.userScope,
      handlers: this.handlers,
      onError: this.onError,
    });
  }

  /** 按绝对 path 定位字段实例（拿到后读写其 signal / setValue）。 */
  field(path: string): Field | undefined {
    return resolveField(this.root, this.root, path);
  }

  /**
   * 批量下发值到各叶子（跑 input-format）。按结构递归匹配 values。
   */
  setValues(values: Record<string, any>): void {
    const makeCtx = this.makeContext.bind(this);
    startBatch();
    try {
      this.assign(this.root, values, makeCtx);
    } finally {
      endBatch();
    }
  }

  /** 递归把 values 派发到字段子树（primitive 跑 input-format，array 重建行）。 */
  private assign(
    field: Field,
    value: any,
    makeCtx: (self: Field) => RuntimeContext,
  ): void {
    if (field instanceof PrimitiveField) {
      const input = field.schema["x-format"]?.input;
      field.setValue(
        input === undefined
          ? value
          : executeRule(input as SchemaRule, makeCtx(field), "formats", value),
      );
    } else if (field instanceof ArrayField) {
      field.setRows(Array.isArray(value) ? value : []);
    } else if (field instanceof ObjectField || field instanceof VoidField) {
      if (value == null) return;
      for (const c of field.children.values())
        this.assign(c, value[c.key], makeCtx);
    }
  }

  /** 递归回落到默认值。 */
  reset(): void {
    startBatch();
    try {
      this.root.reset();
    } finally {
      endBatch();
    }
  }

  /**
   * 装载运行时联动：为每个字段建一个子 effectScope，装 reaction / effect。
   * 未 mount 时值可读、可手动 setValue / validate，但联动不生效。
   */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    const makeCtx = this.makeContext.bind(this);
    this.rootScope = effectScope(() => this.mountField(this.root, makeCtx));
  }

  /** 为单个字段建子 scope 并递归其孩子 / 行。 */
  private mountField(
    field: Field,
    makeCtx: (self: Field) => RuntimeContext,
  ): void {
    effectScope(() => {
      field.install(makeCtx);
      if (field instanceof ObjectField || field instanceof VoidField) {
        for (const c of field.children.values()) this.mountField(c, makeCtx);
      } else if (field instanceof ArrayField) {
        for (const row of field.rows())
          for (const c of row.children.values()) this.mountField(c, makeCtx);
      }
    });
  }

  /** 关闭根 scope，一次性回收全部 reaction / effect 及其 cleanup。 */
  unmount(): void {
    this.rootScope?.();
    this.rootScope = undefined;
    this.mounted = false;
  }

  /** 销毁（等同 unmount）。 */
  destroy(): void {
    this.unmount();
  }

  /**
   * 并发校验所有 display!==none 字段，写回各自 errors，返回是否整体通过。
   */
  async validate(): Promise<boolean> {
    const makeCtx = this.makeContext.bind(this);
    const acc: Field[] = [];
    collectFields(this.root, acc);
    const results = await Promise.all(acc.map((f) => f.validate(makeCtx)));
    return results.every((errs) => errs.length === 0);
  }

  /** 遍历树跑 output-format，返回对外提交值。 */
  getFormattedValues(): Record<string, any> {
    return formatOut(this.root, this.makeContext.bind(this));
  }

  /**
   * 提交：validate() 通过后 getFormattedValues()，再交给 onSubmit。
   * 校验不过则抛出错误列表。
   */
  async submit<T>(
    onSubmit?: (values: Record<string, any>) => T | Promise<T>,
  ): Promise<T> {
    this.submitting(true);
    try {
      const ok = await this.validate();
      if (!ok) throw this.errors();
      const payload = this.getFormattedValues();
      return (await onSubmit?.(payload)) as T;
    } finally {
      this.submitting(false);
    }
  }
}

/**
 * 创建表单实例（对外唯一工厂）。
 */
export function createForm(config: FormConfig): Form {
  return new Form(config);
}
