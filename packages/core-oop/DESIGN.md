# @alien-form/core-oop 技术设计文档

> **定位**：用 alien-signals 3.2.1 构建一个 **schema 驱动的响应式字段引擎**。
> core 只做一件事：把一份**核心 schema** 编译成一棵**响应式字段树（OOP 类模型）**，并提供值 / 校验 / 联动 / 派生。
> core **不认识** UI、不认识 React、不认识「表单 / 表格 / 过滤器 / 详情」等场景。多场景复用是外部构建 schema + React 绑定层的约定。

---

## 1. 设计边界（已拍板）

| 决策 | 说明 |
| --- | --- |
| **表达式用 `new Function`** | schema 由可信后端下发、SPA 场景，安全边界由「schema 可信」保证。`new Function` 生成的函数是 sloppy mode，可用 `with(scope)`，配合 Proxy 保留精确订阅。唯一限制：CSP 需允许 `unsafe-eval`。 |
| **内核采用 OOP** | 字段树用类继承（`Field` → `PrimitiveField` / `ObjectField` / `ArrayField` / `VoidField`）。 |
| **`x-format` 只在初始化 / 提交生效** | `input` 在注入 `initialValues` 时跑一次；`output` 在 `submit()` 时跑一次。**字段 onChange 不跑 format**，因此 format 不进任何 computed。 |
| **`x-validators` 为数组规则**（见 4.1） | 每项内置 `required / max / min / pattern / message`，或 `"{{fn}}"` / `"@name"` / 函数。`required` 已并入此处，schema 顶层不再有 `required`。 |
| **数据源字段名统一为 `options`** | 全代码库不再出现 `dataSource`。 |
| **具名处理器用 `"@name"` 前缀** | rule 字符串以 `@` 开头表示调用 `handlers` 中注册的方法；`{{ }}` 表示表达式。 |
| **最小 API 面** | 选择器解析、投影、表达式编译等全部内部化。 |
| **`component` 恒为 key** | core 只把它当字符串存进信号，不感知具体组件。谁渲染由 React 层 registry 决定。 |

---

## 2. 心智模型

```
   核心 Schema  ──►  createForm({ schema })  ──►  Field 实例树（signals + computed）
   （仅字段定义）        编译成 OOP 类实例                │  values / errors / valid
                                                       │  field(path) → 读写字段
                                          ┌────────────┴───────────┐
                                          ▼                        ▼
                              React 绑定层（registry）        任意其它消费方
```

| 层 | 职责 | 认识什么 |
| --- | --- | --- |
| 核心 Schema | 纯数据：字段结构 + `x-*` 行为协议 | 不认识 UI / 场景 |
| **Core 内核（本文档）** | 编译字段树、值 / 校验 / 联动 / 派生、生命周期 | 只认识核心 schema |
| 外部（构建方 + React） | 附加渲染提示、按场景选 registry、渲染 | 认识 UI 与场景 |

---

## 3. alien-signals 3.2.1 API 基线

已核对 `node_modules/.pnpm/alien-signals@3.2.1/.../types/index.d.ts`：

```ts
signal<T>(initial?: T): { (): T; (v: T): void }
computed<T>(getter: (prev?: T) => T): () => T
effect(fn: () => void | (() => void)): () => void   // ★ 可返回 cleanup（3.2.0）
effectScope(fn: () => void): () => void             // ★ 分组作用域，一次性销毁
startBatch() / endBatch()
getActiveSub() / setActiveSub(sub?)
```

**未导出 `untracked`**，薄封装：

```ts
export function untrack<T>(fn: () => T): T {
  const prev = setActiveSub(undefined);
  try { return fn(); } finally { setActiveSub(prev); }
}
```

- `computed` → 组合式值投影（改一个叶子只失效祖先链）。
- `effect` cleanup → 异步 reaction 无泄漏、无竞态。
- `effectScope` → 字段 / 行生命周期即作用域。

---

## 4. 核心 Schema 规范

### 4.0 命名铁律（单复数）

> **复数 ⇔ 数组；单数 ⇔ 单个。** 全文档强制遵守，不得混用。

| 名称 | 形态 | 单/复 |
| --- | --- | --- |
| `x-reactions` | `SchemaReaction[]`（数组）| 复数 |
| `x-validators` | `ValidatorRule[]`（数组）| 复数 |
| `x-effect` | 单个 `SchemaRule` | 单数 |
| `x-format` | 单个 `{ input?, output? }` | 单数 |
| `handlers.formats` / `.effects` / `.reactions` / `.validators` | 注册表（Record）| 恒复数 |

> 注意：校验器集合是 **`validators`**（名词），不是 `validates`（动词第三人称单数）。

### 4.1 字段 schema（`IFieldSchema`）

```ts
/** 组件 / 装饰器：只写 key，或 [key, props] */
type ComponentSpec = string | [key: string, props: Record<string, any>];

/** 数据源项 */
interface OptionItem { label: string; value: unknown; [k: string]: unknown }

interface IFieldSchema {
  // ── 结构 ──
  type?: "string" | "number" | "boolean" | "object" | "array" | "void";
  title?: string;
  description?: string;
  default?: any;
  order?: number;
  properties?: Record<string, IFieldSchema>;   // object / void 用
  items?: IFieldSchema;                         // array 用：单个元素 schema

  // ── 渲染意图（core 只存 key/值，不感知具体组件）──
  display?: "visible" | "hidden" | "none";
  disabled?: boolean;
  component?: ComponentSpec;
  decorator?: ComponentSpec;
  options?: OptionItem[];

  // ── 行为协议（运行时）──
  "x-reactions"?: SchemaReaction[];            // 复数 = 数组：多条联动
  "x-effect"?: SchemaRule;                     // 单数 = 单个副作用
  "x-format"?: { input?: SchemaRule; output?: SchemaRule };   // 单数 = 单个对象
  "x-validators"?: ValidatorRule[];            // 复数 = 数组：多条校验，顺序执行
}

/** 单条联动：把某个状态 target 绑定到一条 rule 的求值结果 */
interface SchemaReaction {
  target: ReactionKey;      // 作用到哪个状态
  rule: SchemaRule;         // "{{expr}}" | "@name"(→ handlers.reactions) | 函数 | 字面量
}

/** x-reactions 可驱动的字段状态白名单（唯一权威来源） */
type ReactionKey =
  | "value"          // 计算值（联动赋值，仅 primitive）
  | "display"
  | "disabled"
  | "title"
  | "description"
  | "component"
  | "decorator"
  | "options";
// 结构键（type / properties / items）与 x-* 本身不可被 reaction 驱动。

/** 单条校验规则 */
type ValidatorRule =
  | {
      message?: string;
      required?: boolean;
      max?: number;      // string.length / number 值 / array.length
      min?: number;      // 同上
      pattern?: string;  // 编译成 RegExp
    }
  | SchemaRule;          // "{{expr}}" | "@name"(→ handlers.validators) | 函数
```

### 4.2 表单 schema（`IFormSchema`）

```ts
interface IFormSchema {
  type: "object";
  properties?: Record<string, IFieldSchema>;
  "x-reactions"?: SchemaReaction[];
  "x-effect"?: SchemaRule;
}
```

### 4.3 规则统一类型（`SchemaRule`）

```ts
/** 一切 x-* 求值单元的统一形态 */
type SchemaRule =
  | string                              // "{{ expr }}" 表达式 | "@name" 具名处理器
  | ((ctx: RuntimeContext) => any)      // 函数，可返回 Promise
  | number | boolean | null | object | any[];   // 字面量，原样返回
```

三种字符串语义（`rule.ts` 分派）：

| 形态 | 含义 | 求值 |
| --- | --- | --- |
| `"{{ ... }}"` | 表达式 | `new Function` + Proxy 编译（第 8 节）|
| `"@name"` | 具名处理器 | 按**所在协议**查对应命名空间（见下）|
| 其它字符串 / 数字 / 布尔 / 对象 / 数组 | 字面量 | 原样返回 |

**`"@name"` 的命名空间由它出现的协议决定**（不共享同一张表）：

| 出现位置 | 查表 | handler 签名 |
| --- | --- | --- |
| `x-reactions[].rule` | `handlers.reactions[name]` | `(ctx) => any` |
| `x-effect` | `handlers.effects[name]` | `(ctx) => void \| (() => void)` |
| `x-format.input` / `.output` | `handlers.formats[name]` | `(value, ctx) => any` |
| `x-validators[]`（`SchemaRule` 形态）| `handlers.validators[name]` | `(value, ctx) => true \| string \| Promise<...>` |

---

## 5. 响应式值模型

> **叶子持 `value` signal；容器 `value` 是组合孩子的 `computed`；`form.values = root.value`。**
> `x-format` **不在这里**——它只在初始化 / 提交时跑（第 7.4 节）。

```ts
// 叶子：value 是 signal（可读可写）
class PrimitiveField {
  readonly value = signal<any>(undefined);   // 内部值，未经 output-format
}

// object：value 是 computed，只组合孩子的内部值
this.value = computed(() => {
  const out: Record<string, any> = {};
  for (const child of orderedChildren(this)) {
    if (child.display() === "none") continue;   // display:none 不进值
    if (child.kind === "void") {
      Object.assign(out, child.value());        // void 摊平：提升其 children 到父层
    } else {
      out[child.key] = child.value();
    }
  }
  return out;
});

// array：value 是 computed
this.value = computed(() => this.rows().map(r => r.value()));

// void：value 是 computed，返回「其 children 组合成的对象」，由父层 Object.assign 摊平
this.value = computed(() => composeChildren(this));   // 结构同 object
```

> **统一读法**：无论 primitive / object / array / void，都通过 `field.value()` 读取。primitive 是 signal getter，容器是 computed getter，签名一致。写入只对 primitive 经 `setValue`。

| 维度 | 全树遍历投影（旧）| 组合式 computed（本设计）|
| --- | --- | --- |
| 改一个叶子 | O(N) 全树重算 | 只失效祖先链 O(depth) |
| 未变子树 | 每次新对象、引用不等 | computed 缓存、同一引用（结构共享）|
| 读 `values` | 不幂等 | 幂等（命中缓存）|
| React bail-out | 不可能 | 可靠 |

**写入**：唯一入口是叶子 `setValue`；`setValues` 在 `startBatch` 内从根按结构下发到各叶子；`reset` 递归回落到 `default`。

**初始值注入**：`createForm` 构建树时，按 path 把 `initialValues` 派发到各叶子，注入前对每个叶子跑一次 `x-format.input`（外→内）。数组字段按初始值数组长度生成对应数量的 `Row`。

---

## 6. 字段节点模型（OOP 类）

```ts
type FieldKind = "primitive" | "object" | "array" | "void";
let _uid = 0;
const uid = () => `f${++_uid}`;

interface FieldError { path: string; message: string }

abstract class Field {
  readonly id = uid();          // 稳定身份，永不变
  readonly key: string;         // 在父级中的键
  abstract readonly kind: FieldKind;
  schema: IFieldSchema;
  parent?: Field;
  row?: Row;

  // 状态信号
  readonly display   = signal<"visible" | "hidden" | "none">("visible");
  readonly disabled  = signal(false);
  readonly required  = signal(false);              // 由 x-validators 中的 required 派生，供 UI 星号
  readonly errors    = signal<FieldError[]>([]);
  readonly title     = signal("");
  readonly description = signal("");
  readonly component = signal<string>("");         // 只存 key
  readonly componentProps = signal<Record<string, any>>({});
  readonly decorator = signal<string>("");         // 只存 key
  readonly decoratorProps = signal<Record<string, any>>({});
  readonly options   = signal<OptionItem[]>([]);
  readonly loading   = signal(false);

  abstract readonly value: () => any;   // primitive=signal getter；容器=computed getter

  get path(): string {                  // 惰性派生，不存储
    if (!this.parent) return "";
    const seg = this.row ? String(this.row.index()) : this.key;
    return this.parent.path ? `${this.parent.path}.${seg}` : seg;
  }

  setComponent(spec: ComponentSpec) {
    const [k, p] = Array.isArray(spec) ? spec : [spec, undefined];
    this.component(k);
    if (p) this.componentProps({ ...this.componentProps(), ...p });
  }
  setDecorator(spec: ComponentSpec) { /* 同上 */ }

  abstract reset(): void;
  async validate(): Promise<FieldError[]> { /* 见 7.5 */ }

  /** 由 Form 在 mount 阶段调用；把 reaction / effect 装进当前 effectScope */
  protected install(ctx: RuntimeContext): void { /* installReaction / installEffect */ }
}

class PrimitiveField extends Field {
  readonly kind = "primitive";
  readonly value = signal<any>(undefined);
  setValue(v: any) { if (!Object.is(this.value(), v)) this.value(v); }
  reset() { this.setValue(this.schema.default); this.errors([]); }
}

class ObjectField extends Field {
  readonly kind = "object";
  readonly children = new Map<string, Field>();
  readonly value = computed(() => composeChildren(this));   // 第 5 节
  reset() { for (const c of this.children.values()) c.reset(); }
}

class ArrayField extends Field {
  readonly kind = "array";
  readonly rows = signal<Row[]>([]);
  readonly value = computed(() => this.rows().map(r => r.value()));
  push(v?: any): Row { /* 追加 Row，index=len */ }
  remove(i: number): void { /* 删 Row，后续 row.index() 下移 */ }
  move(a: number, b: number): void { /* 交换/移动，重排后刷新各 row.index() */ }
  setRows(vs: any[]): void { /* 按数组重建 rows */ }
  reset() { this.setRows(Array.isArray(this.schema.default) ? this.schema.default : []); }
}

class VoidField extends Field {          // 纯布局，数据透明
  readonly kind = "void";
  readonly children = new Map<string, Field>();
  readonly value = computed(() => composeChildren(this));   // 由父层 Object.assign 摊平
  reset() { for (const c of this.children.values()) c.reset(); }
}

class Row {                              // 数组一行
  readonly id = uid();                   // 稳定身份，React key 用它
  readonly index = signal(0);            // 重排只改它，path 自动更新
  readonly children = new Map<string, Field>();
  readonly value = computed(() => composeChildren(this));
}
```

**收益**：身份 = 稳定 `id`；`path` 惰性派生；数组重排只改 `row.index()`，不再递归重写路径、不再重建索引 Map。

---

## 7. 运行时协议

`x-reactions` / `x-effect` / `x-format` 经统一的 `executeRule(rule, ctx)` 求值；`x-validators` 走独立的 `runValidator`（见 7.5）。

### 7.1 `x-reactions`（声明式联动，数组）
`x-reactions` 是 `SchemaReaction[]`。**每个数组项**（`{ target, rule }`）装一个独立 `effect`；rule 结果按 `target` 语义写入对应 signal：

| target | apply 到 | 期望返回 |
| --- | --- | --- |
| `value` | `setValue(r)`（仅 primitive）| 任意值 |
| `display` | `display(r)` | `"visible" \| "hidden" \| "none"` |
| `disabled` | `disabled(r)` | boolean |
| `title` / `description` | 对应 signal | string |
| `component` / `decorator` | `setComponent` / `setDecorator` | `ComponentSpec` |
| `options` | `options(r)` | `OptionItem[]` |

多条 reaction 相互独立、各自精确订阅。若多条写同一 `target`，按数组顺序后者覆盖（同一 tick 内以最后执行者为准）。依赖由 alien-signals 自动追踪。

### 7.2 异步 reaction —— effect cleanup 收敛

```ts
install(ctx) {
  for (const { target, rule } of this.schema["x-reactions"] ?? []) {
    effect(() => {
      const r = executeRule(rule, ctx, "reactions");   // @name → handlers.reactions
      if (!isPromise(r)) { applyReaction(this, target, r); return; }
      let stale = false;
      this.loading(true);
      r.then(v => { if (!stale) applyReaction(this, target, v); })
       .catch(e => ctx.onError(e))
       .finally(() => { if (!stale) this.loading(false); });
      return () => { stale = true; };   // ★ 重跑 / 销毁前作废上一次
    });
  }
}
```

杜绝旧实现两个 bug：disposer 无限增长（泄漏）、旧 Promise 覆盖新值（竞态）。

### 7.3 `x-effect`（命令式副作用，单个）
`x-effect` 是**单个** `SchemaRule`，装进字段 effectScope 的一个 `effect`；`@name` 查 `handlers.effects`；rule 若返回清理函数则在重跑 / 销毁时执行。

### 7.4 `x-format`（转换，非响应式，单个）
`x-format` 是**单个** `{ input?, output? }`；`@name` 查 `handlers.formats`，签名 `(value, ctx) => any`。
- `input`（外→内）：仅在 `createForm` 注入 `initialValues`、以及 `setValues` 时对相应叶子跑一次。
- `output`（内→外）：仅在 `submit()` / `getFormattedValues()` 时遍历树对相应叶子跑一次。
- **不进任何 computed**，`form.values()` 返回的是未经 output-format 的内部值。

### 7.5 `x-validators`（校验，数组）
`x-validators` 是 `ValidatorRule[]`，**按数组顺序**逐条执行 `runValidator(field, rule)`：

- **对象规则**：依次检查 `required`（空值判定：`undefined/null/"" /[]`）、`max`/`min`（作用于 `string.length` / `number` 值 / `array.length`）、`pattern`（`new RegExp(pattern).test(String(value))`）。任一不过 → 产生一条错误，`message` 为其文案（缺省用内置默认文案）。
- **`SchemaRule` 规则**：`@name` 查 `handlers.validators`（签名 `(value, ctx) => true | string | Promise<...>`）；表达式/函数同理求值（可 async）。返回 `true` / `undefined` 通过，返回 `false` / `string` 为错误（string 即文案）。

一个字段的多条校验产生的错误合并进 `field.errors`（默认全部执行并收集；如需短路可后续加开关）。构建时若任一对象规则含 `required: true`，把 `field.required` signal 置 true（供 UI 星号）。`form.validate()` 并发跑所有 `display() !== "none"` 的字段，聚合到 `form.errors`。

---

## 8. 表达式：new Function + Proxy 精确订阅

字符串 `"{{ expr }}"` 编译（无自研 AST），`{{ }}` 由 `rule.ts` 剥离后传入：

```ts
const cache = new Map<string, (scope: object) => any>();

function compile(body: string): (scope: object) => any {
  let fn = cache.get(body);
  if (!fn) {
    // new Function 生成的函数是 sloppy mode → 允许 with
    fn = new Function("$scope", `with($scope){ return (${body}); }`) as any;
    cache.set(body, fn);
  }
  return fn!;
}
```

**为何用 Proxy**：`with(普通对象)` 需预先把所有字段摊进 scope，会一次性 read 全部字段 signal → 退化成「全表单订阅」；且找不到的标识符会穿透外层或抛 `ReferenceError`。Proxy 用 `has` 恒 true 拦下所有裸标识符，`get` 惰性读 → **只订阅表达式真正访问到的字段**。

```ts
function buildScope(field: Field, ctx: RuntimeContext): object {
  const target = {
    get $value()  { return field.value(); },
    get $values() { return ctx.root.value(); },
    $self: field,
    $path: field.path,
    $get: (sel: string) => ctx.get(sel),   // 见第 9 节选择器
    ...ctx.userScope,
  };
  return new Proxy(target, {
    has() { return true; },
    get(t, k: string) {
      if (k === Symbol.unscopables) return undefined;  // with 必需
      if (k in t) return (t as any)[k];
      return ctx.get(k);                                // 裸字段名 → 读该字段（订阅）
    },
  });
}
```

- `{{ status === 'vip' }}` → 仅订阅 `status`；`{{ $get('a.b') > 0 }}` → 仅订阅 `a.b`。
- 唯一限制：CSP 禁 `unsafe-eval` 时不可用（SPA + 可信 schema 前提下接受）。
- 函数型 rule `(ctx) => …` 无需编译，从 `ctx` 上按需读字段，天然精确订阅。

---

## 9. 选择器与路径

**path 语法**：点分隔，数组用数字下标。示例：`user.name`、`items.0.price`。

**`ctx.get(selector)` 解析顺序**（用于 `$get` 与裸标识符）：

1. `selector` 以 `.` / `..` 开头 → **相对**当前字段：`./sibling` 同级、`../uncle` 父级的兄弟。
2. 命中 `ctx.userScope` / 内置（`$value` 等）→ 返回之。
3. 其余按 **绝对 path 从根解析**：逐段走 `children` / `rows`，命中叶子返回 `value()`（订阅），命中容器返回 `value()`。
4. 解析不到 → `undefined`（不抛错）。

`form.field(path)` 用同样的绝对 path 规则定位并返回 `Field` 实例（拿到后读写其 signal / `setValue`）。

> 数组批量选择器（如 `arr[].child`）不在首版范围内，避免歧义；需要时以后单独定义「读=收集、写=广播」语义。

---

## 10. 生命周期：effectScope 作用域树

```ts
class Form {
  private rootScope?: () => void;
  private mounted = false;

  mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.rootScope = effectScope(() => this.mountField(this.root));
  }
  private mountField(f: Field) {
    effectScope(() => {                       // 每个字段一个子 scope
      (f as any).install(this.ctx);           // 装 reaction / effect
      if (f instanceof ObjectField || f instanceof VoidField)
        for (const c of f.children.values()) this.mountField(c);
      if (f instanceof ArrayField)
        for (const r of f.rows()) for (const c of r.children.values()) this.mountField(c);
    });
  }
  unmount() { this.rootScope?.(); this.rootScope = undefined; this.mounted = false; }
  destroy() { this.unmount(); }
}
```

- 移除一行数组时关闭该行子 scope，一次性回收其 reaction / effect 及 cleanup。
- **未 `mount()` 时**：`values()` / `field(path)` / 手动 `setValue` 可用（computed 惰性求值）；但 `x-reactions` / `x-effect` 联动**不生效**（尚未装 effect）。`validate()` 可手动调用。构建（`createForm`）与 `mount()` 分离，便于 SSR / 受控。

---

## 11. 最小公开 API

```ts
type ReactionHandler  = (ctx: RuntimeContext) => any;
type EffectHandler    = (ctx: RuntimeContext) => void | (() => void);
type FormatHandler    = (value: any, ctx: RuntimeContext) => any;
type ValidatorHandler = (value: any, ctx: RuntimeContext) => true | string | Promise<true | string>;

interface Handlers {                            // 四个命名空间，恒复数
  reactions?: Record<string, ReactionHandler>;
  effects?:   Record<string, EffectHandler>;
  formats?:   Record<string, FormatHandler>;
  validators?: Record<string, ValidatorHandler>;
}

function createForm(config: {
  schema: IFormSchema;
  initialValues?: Record<string, any>;
  scope?: Record<string, any>;                 // 表达式 / 函数 rule 的额外作用域（→ ctx.userScope）
  handlers?: Handlers;                          // "@name" 具名处理器，按协议分命名空间
  onError?: (e: unknown) => void;
}): Form;

class Form {
  readonly values: () => Record<string, any>;  // computed = root.value（内部值，未跑 output-format）
  readonly errors: () => FieldError[];          // computed
  readonly valid:  () => boolean;               // computed
  readonly submitting: () => boolean;           // signal

  field(path: string): Field | undefined;       // 直接拿字段，读写走 field 自身
  setValues(values: Record<string, any>): void; // 批量下发到叶子（跑 input-format）
  reset(): void;
  mount(): void;
  unmount(): void;
  destroy(): void;
  validate(): Promise<boolean>;
  getFormattedValues(): Record<string, any>;    // 遍历树跑 output-format
  submit<T>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>;
  // submit = validate() 通过 → getFormattedValues() → onSubmit(payload)
}
```

`RuntimeContext`（内部类型，用于 rule 求值）：

```ts
interface RuntimeContext {
  root: Field;                          // 根字段
  self: Field;                          // 当前求值的字段（相对选择器基准）
  get(selector: string): any;           // 第 9 节
  userScope: Record<string, any>;       // = config.scope
  handlers: Handlers;                   // 四命名空间
  onError: (e: unknown) => void;
}
```

---

## 12. 目录结构

```
packages/core-oop/src/
  signals.ts        # untrack 薄封装
  schema.ts         # 核心 schema 类型 + normalize
  runtime/
    compile.ts      # new Function + Proxy 表达式编译（精确订阅）
    rule.ts         # executeRule：{{expr}} / @handler / 函数 / 字面量 分派
    context.ts      # RuntimeContext / buildScope / 选择器解析
    validate.ts     # runValidator（对象规则 + SchemaRule）
  field/
    field.ts        # abstract Field
    primitive.ts    # PrimitiveField
    object.ts       # ObjectField（含 composeChildren）
    array.ts        # ArrayField + Row
    void.ts         # VoidField
  build.ts          # schema → Field 实例树 + initialValues 注入（跑 input-format）
  form.ts           # class Form + createForm（组装、mount/effectScope、submit）
  index.ts          # 仅导出 createForm、公开类型
```

---

## 附录 A：示例 schema

```ts
const orderSchema: IFormSchema = {
  type: "object",
  properties: {
    title: {
      type: "string", title: "订单标题",
      component: ["Input", { placeholder: "请输入" }],
      "x-validators": [                                  // 复数 = 数组
        { required: true, max: 50, message: "标题必填且不超过 50 字" },
      ],
    },
    status: {
      type: "string", title: "状态", component: "Select",
      options: [
        { label: "待支付", value: "pending" },
        { label: "已完成", value: "done" },
      ],
      "x-reactions": [                                   // 复数 = 数组
        { target: "display", rule: "{{ title ? 'visible' : 'none' }}" },  // 仅订阅 title
      ],
    },
    amount: {
      type: "number", title: "金额", component: "InputNumber",
      "x-format": {                                      // 单数 = 单个对象，仅初始化/提交生效
        input: "@centsToYuan",
        output: "@yuanToCents",
      },
      "x-validators": [
        "{{ $value >= 0 }}",
      ],
    },
  },
};

const form = createForm({
  schema: orderSchema,
  initialValues: { amount: 1000 },
  handlers: {
    formats: {                                           // format handler 签名：(value, ctx)
      centsToYuan: (value) => value / 100,
      yuanToCents: (value) => value * 100,
    },
  },
});
form.mount();
```
