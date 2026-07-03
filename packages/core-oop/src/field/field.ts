import { computed, effect, signal } from "alien-signals";
import {
  type ComponentSpec,
  type FieldError,
  type FieldKind,
  type IFieldSchema,
  type OptionItem,
  type ReactionKey,
  type RuntimeContext,
  normalizeComponent,
} from "../schema";
import { executeRule } from "../runtime/rule";
import { runValidators } from "../runtime/validate";

/** 单调递增计数器，产出稳定字段 id。 */
let _uid = 0;
/** 生成永不重复的稳定 id。 */
const uid = (): string => `f${++_uid}`;

/** 判断值是否为 Promise（thenable）。 */
function isPromise(v: any): v is Promise<any> {
  return !!v && typeof v.then === "function";
}

/** 由 Form 注入：给定字段返回其专属 RuntimeContext（self 指向该字段）。 */
export type ContextFactory = (self: Field) => RuntimeContext;

/**
 * 字段抽象基类：持有全部状态 signals、身份 id 与惰性 path，
 * 并负责把 x-reactions / x-effect 装载进当前 effectScope。
 */
export abstract class Field {
  /** 稳定身份，永不变。 */
  readonly id = uid();
  /** 字段种类。 */
  abstract readonly kind: FieldKind;
  /** 统一读值入口：primitive 为 signal getter，容器为 computed getter。 */
  abstract readonly value: () => any;

  /** 状态信号。 */
  readonly display = signal<"visible" | "hidden" | "none">("visible");
  readonly disabled = signal(false);
  readonly required = signal(false);
  readonly errors = signal<FieldError[]>([]);
  readonly title = signal("");
  readonly description = signal("");
  readonly component = signal<string>("");
  readonly componentProps = signal<Record<string, any>>({});
  readonly decorator = signal<string>("");
  readonly decoratorProps = signal<Record<string, any>>({});
  readonly options = signal<OptionItem[]>([]);
  readonly loading = signal(false);

  /**
   * 依据 schema 初始化基础状态（title / display / disabled / component 等）。
   */
  constructor(
    readonly key: string,
    readonly schema: IFieldSchema,
    public parent?: Field,
    public row?: Row,
  ) {
    if (schema.title != null) this.title(schema.title);
    if (schema.description != null) this.description(schema.description);
    if (schema.display != null) this.display(schema.display);
    if (schema.disabled != null) this.disabled(schema.disabled);
    if (schema.options != null) this.options(schema.options);
    if (schema.component != null) this.setComponent(schema.component);
    if (schema.decorator != null) this.setDecorator(schema.decorator);
  }

  /** 惰性派生路径：随 row.index() 变化自动更新，不落地存储。 */
  get path(): string {
    if (!this.parent) return "";
    const seg = this.row ? String(this.row.index()) : this.key;
    return this.parent.path ? `${this.parent.path}.${seg}` : seg;
  }

  /** 写入 component key（并合并 props）。 */
  setComponent(spec: ComponentSpec): void {
    const [k, p] = normalizeComponent(spec);
    this.component(k);
    if (p) this.componentProps({ ...this.componentProps(), ...p });
  }

  /** 写入 decorator key（并合并 props）。 */
  setDecorator(spec: ComponentSpec): void {
    const [k, p] = normalizeComponent(spec);
    this.decorator(k);
    if (p) this.decoratorProps({ ...this.decoratorProps(), ...p });
  }

  /** 把一条 reaction 求值结果按 target 语义写入对应 signal。 */
  protected applyReaction(target: ReactionKey, r: any): void {
    switch (target) {
      case "value":
        if (this instanceof PrimitiveField) this.setValue(r);
        break;
      case "display":
        this.display(r);
        break;
      case "disabled":
        this.disabled(r);
        break;
      case "title":
        this.title(r);
        break;
      case "description":
        this.description(r);
        break;
      case "component":
        this.setComponent(r);
        break;
      case "decorator":
        this.setDecorator(r);
        break;
      case "options":
        this.options(r);
        break;
    }
  }

  /**
   * 装载运行时协议（在字段 effectScope 内被调用）：
   * 每条 x-reactions 装一个独立 effect（含异步 cleanup 收敛，杜绝泄漏与竞态）；
   * x-effect 装单个 effect（其返回的清理函数在重跑 / 销毁时执行）。
   */
  install(makeCtx: ContextFactory): void {
    const ctx = makeCtx(this);
    for (const { target, rule } of this.schema["x-reactions"] ?? []) {
      effect(() => {
        const r = executeRule(rule, ctx, "reactions");
        if (!isPromise(r)) {
          this.applyReaction(target, r);
          return;
        }
        let stale = false;
        this.loading(true);
        r.then((v) => {
          if (!stale) this.applyReaction(target, v);
        })
          .catch((e) => ctx.onError(e))
          .finally(() => {
            if (!stale) this.loading(false);
          });
        return () => {
          stale = true;
        };
      });
    }
    const fx = this.schema["x-effect"];
    if (fx !== undefined) {
      effect(() => executeRule(fx, ctx, "effects"));
    }
  }

  /**
   * 校验本字段：按顺序执行 x-validators，结果写入 errors signal 并返回。
   */
  async validate(makeCtx: ContextFactory): Promise<FieldError[]> {
    const rules = this.schema["x-validators"];
    if (!rules || rules.length === 0) {
      this.errors([]);
      return [];
    }
    const errs = await runValidators(
      rules,
      this.value(),
      this.path,
      makeCtx(this),
    );
    this.errors(errs);
    return errs;
  }

  /** 递归重置到默认值并清空错误。 */
  abstract reset(): void;
}

/** 叶子字段：value 为可读写 signal，未经 output-format。 */
export class PrimitiveField extends Field {
  readonly kind = "primitive" as const;
  readonly value = signal<any>(undefined);

  /** 写入内部值（Object.is 短路，避免无意义触发）。 */
  setValue(v: any): void {
    if (!Object.is(this.value(), v)) this.value(v);
  }

  /** 回落到 schema.default 并清空错误。 */
  reset(): void {
    this.setValue(this.schema.default);
    this.errors([]);
  }
}

/**
 * 组合子字段为对象值：按 order 排序，跳过 display:none，void 字段摊平提升到本层。
 */
export function composeChildren(
  container: { children: Map<string, Field> },
): Record<string, any> {
  const out: Record<string, any> = {};
  const ordered = [...container.children.values()].sort(
    (a, b) => (a.schema.order ?? 0) - (b.schema.order ?? 0),
  );
  for (const child of ordered) {
    if (child.display() === "none") continue;
    if (child.kind === "void") Object.assign(out, child.value());
    else out[child.key] = child.value();
  }
  return out;
}

/** 对象字段：value 为组合孩子的 computed。 */
export class ObjectField extends Field {
  readonly kind = "object" as const;
  readonly children = new Map<string, Field>();
  readonly value = computed(() => composeChildren(this));

  /** 递归重置所有孩子。 */
  reset(): void {
    for (const c of this.children.values()) c.reset();
  }
}

/** Void 字段：纯布局、数据透明，value 与 object 同构，由父层摊平。 */
export class VoidField extends Field {
  readonly kind = "void" as const;
  readonly children = new Map<string, Field>();
  readonly value = computed(() => composeChildren(this));

  /** 递归重置所有孩子。 */
  reset(): void {
    for (const c of this.children.values()) c.reset();
  }
}

/** 数组一行：稳定 id 作 React key，index 变更驱动子字段 path 更新。 */
export class Row {
  readonly id = uid();
  readonly index = signal(0);
  readonly children = new Map<string, Field>();
  readonly value = computed(() => composeChildren(this));

  /** 记录所属数组字段，供 path 派生使用。 */
  constructor(public parent: ArrayField) {}

  /** 惰性行路径：数组字段路径 + 当前下标。 */
  get path(): string {
    const base = this.parent.path;
    return base ? `${base}.${this.index()}` : String(this.index());
  }
}

/** 数组字段：value 为各行值组成的 computed 数组。 */
export class ArrayField extends Field {
  readonly kind = "array" as const;
  readonly rows = signal<Row[]>([]);
  readonly value = computed(() => this.rows().map((r) => r.value()));

  /** 由 build 层注入的行构造器：给定 Row 填充其子字段。 */
  buildRow?: (row: Row, init?: any) => void;

  /** 依据当前 rows 顺序刷新每行 index()。 */
  private reindex(rows: Row[]): void {
    rows.forEach((r, i) => {
      if (r.index() !== i) r.index(i);
    });
  }

  /** 追加一行（可带初始值），返回新行。 */
  push(init?: any): Row {
    const row = new Row(this);
    this.buildRow?.(row, init);
    const next = [...this.rows(), row];
    this.reindex(next);
    this.rows(next);
    return row;
  }

  /** 删除第 i 行，其余行 index 自动下移。 */
  remove(i: number): void {
    const next = this.rows().filter((_, idx) => idx !== i);
    this.reindex(next);
    this.rows(next);
  }

  /** 把第 a 行移动到位置 b，重排后刷新 index。 */
  move(a: number, b: number): void {
    const next = [...this.rows()];
    const [moved] = next.splice(a, 1);
    next.splice(b, 0, moved);
    this.reindex(next);
    this.rows(next);
  }

  /** 按给定值数组重建所有行。 */
  setRows(vs: any[]): void {
    const rows = (Array.isArray(vs) ? vs : []).map((v) => {
      const row = new Row(this);
      this.buildRow?.(row, v);
      return row;
    });
    this.reindex(rows);
    this.rows(rows);
  }

  /** 回落到 schema.default（数组）或清空。 */
  reset(): void {
    this.setRows(Array.isArray(this.schema.default) ? this.schema.default : []);
  }
}
