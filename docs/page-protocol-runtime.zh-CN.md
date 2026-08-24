# 页面协议与运行时注册（Page Protocol & Runtime Register）

> 目标：把「一个模型的页面长什么样」从写死的 JSX 抽象成一份可组合、可替换、可按模型定制的**页面协议**；
> 页面 = 由 `$af-ui` 节点组成的递归 UI 树，节点实现由**运行时注册表**按域（global / model）提供，
> 节点之间的数据流由 alien-signal 驱动的 **DataScope** 管线串联。
>
> 本文是设计规格（spec），冻结协议形态与边界，供后续实现对齐。不含实现代码。
> 本协议采用一次性迁移策略：不保留历史页面实现，不兼容旧布局、旧注册方式或旧请求入口。

---

## 0. 术语

| 术语                            | 含义                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| **Schema**                      | 模型构建器编辑并提交、由后端持久化的模型描述，含字段与顶层 `x-layout`；运行时只读。  |
| **`$af-ui` 节点**               | 页面协议的唯一 marker：`{ plugin: "$af-ui", component, props?, children?, slot? }`。 |
| **UI 插件**                     | 一个 `component` 名对应的 React 实现（tsx），由 register 注册。                      |
| **Register / RegisterDescribe** | 「当前域内哪些组件合法 + 提供哪些资源」的声明。**不产 Schema**。                     |
| **域（domain）**                | 注册作用域：`global`（全局）或某个 `modelCode`（模型域）。                           |
| **RuntimeCore**                 | 单例运行时，持有所有域的注册表与全局能力，`RuntimeCore.current` 访问。               |
| **DataScope**                   | 具名数据域，signal 化的 `filters / pagination / sorter / selection / records`。      |
| **scope**                       | 注入 alien-form 表达式与 UI 组件的资源对象，键为 `$af_scope_*`。                     |

---

## 1. 设计原则（不可动摇的边界）

1. **Schema 与 Register 职责分离。**
   - Schema（含 `x-layout`）由模型构建器编辑、由后端持久化后作为运行时唯一输入，只声明「用哪个组件 + 参数」。
   - Register 只声明「本域内哪个 `component` 名合法、对应哪个 tsx 实现」以及 services / constant / form 资源。
   - **Register 绝不拼 Schema、绝不产布局数据，也不覆盖 Schema 的 `x-layout`。**
2. **`packages/shared` 保持纯净。** 所有 RuntimeCore、register、UI 插件实现落在 `apps/alien-cms`。
   shared 仅新增：`AfUiNode` 类型、`Compiled.layout` 透传指针、中性的 `RuntimeResourceContext`。
   不得引入 `RuntimeCore` / `register` / `crud` / `x-cms` / `x-model` 等业务标识符，
   继续通过 `scripts/check-architecture.mjs`。
3. **复用既有机制，不重造轮子。**
   - marker 协议复用现有 `PluginMarker`（`{ plugin: "$xxx", ... }`）。
   - 响应式复用 `@alien-form/core` re-export 的 `signal / computed / effect / startBatch / endBatch`
     与 `@alien-form/react` 的 `useSignalValue`（`useSyncExternalStore` 桥接）。
   - form 组件 / 装饰器 / handlers 直接透传 alien-form，不自造表单机制。
4. **后端零改动。** 树表能力通过前端拼树 + 现有 `filters` 的 `IN` 语义实现（见 §7）。
5. **不兼容历史实现。**
   - 删除固定的 `filter + table` 页面 JSX；它只作为模型构建器的默认 `x-layout` JSON 模板存在。
   - 删除匿名 `request`、旧 `src/services` 请求函数和旧布局入口。
   - 不提供旧 `ui` / `child` / `childs` 等别名，不提供未知组件降级，不提供旧 Schema 自动转换。
   - Schema、`x-layout`、Register 和 services 任一协议校验失败都必须明确报错，禁止静默回退。
   - 顶层 `x-layout` 的值必须是 `$af-ui` 节点树；旧的字符串布局值和旧表单布局容器语义一律不再解析。

---

## 2. 页面协议：`$af-ui` 节点树

全协议只有**一种** marker，页面级布局与字段级组件引用同构：

```ts
interface AfUiNode {
  plugin: "$af-ui";
  component: string; // 运行时 UI 注册表的 key，如 "treelayout" / "table" / "action-add"
  props?: Record<string, unknown>; // 传给该组件的参数
  slot?: string; // 落到父容器的哪个具名槽（缺省用容器默认槽）
  children?: AfUiNode[]; // 子节点
  slots?: Record<string, AfUiNode[]>; // 父组件声明的具名插槽内容
}
```

- **页面级**：Schema 顶层 `x-layout` 是一棵 `AfUiNode` 树（如 treelayout → tree + filter + table）。
- **字段级/任意位置**：Schema 中任意位置同样可写 `{ plugin: "$af-ui", component, props }` 引用组件。
- **合法性即注册**：渲染期用 `component` 去运行时注册表查实现；
  **查不到 = 本域非法组件 → 抛出明确的协议错误**，不得渲染占位、不得丢弃节点、不得回退到 children。

### 2.1 布局来源与约束

布局只有一个来源：**Schema 顶层 `x-layout`**。Register 只提供节点实现，不参与布局选择。

模型构建器在第二步提供 `x-layout` JSON 编辑器，并在新建模型时写入默认布局；
因此保存后的 Schema 必须始终包含合法的 `x-layout`，运行时不再根据缺失字段注入默认值。

```text
模型构建器第二步 x-layout JSON
  → ModelDraft.layout
  → draftToSchema()
  → Schema.x-layout
  → RuntimeCore 按 component 查找合法 UI 实现
```

### 2.2 编译产物透传

编译器照旧产出物料 `form / filter / columns`，并把顶层布局透传成不透明指针：

```ts
interface Compiled {
  meta: ModelMeta;
  form: IFormSchema;
  filter: IFormSchema;
  columns: TableColumn[];
  layout: AfUiNode; // Schema.x-layout 的透传结果，必填且不解释内容
}
```

`layout` 是不透明指针，不含任何业务标识，符合 shared 边界。UI 节点通过渲染上下文各取物料：
`filter` 用 `compiled.filter`、`table` 用 `compiled.columns`、`form`/overlay 用 `compiled.form`。

### 2.3 默认 `filter + table` 布局

模型构建器第二步的 `x-layout` JSON 输入框默认填充以下内容。用户可以直接编辑 JSON，
以组合 `treelayout`、`tree`、`filter`、`table` 和动作节点：

```json
{
  "plugin": "$af-ui",
  "component": "page",
  "children": [
    {
      "plugin": "$af-ui",
      "component": "filter",
      "props": { "scope": "main" }
    },
    {
      "plugin": "$af-ui",
      "component": "table",
      "props": { "scope": "main" },
      "slots": {
        "toolbarLeft": [{ "plugin": "$af-ui", "component": "action-batch-delete" }],
        "toolbarRight": [
          { "plugin": "$af-ui", "component": "action-refresh" },
          { "plugin": "$af-ui", "component": "action-add" }
        ]
      },
      "children": [
        {
          "plugin": "$af-ui",
          "component": "row-actions",
          "children": [
            { "plugin": "$af-ui", "component": "detail" },
            { "plugin": "$af-ui", "component": "edit" },
            { "plugin": "$af-ui", "component": "delete" }
          ]
        }
      ]
    }
  ]
}
```

JSON 输入必须在编辑时完成语法与协议校验：根节点必须是 `$af-ui` 节点，
所有 `children` 必须是节点数组，所有 `component` 必须是非空字符串。
保存时校验失败不得提交模型。

### 2.4 模型构建器第二步

模型构建器固定为以下三个步骤：

1. **字段**：编辑字段及其字段 Schema。
2. **分组与元信息、页面布局**：编辑模型信息、表单分组，以及 `x-layout` JSON。
3. **预览保存**：预览最终 Schema，校验通过后保存。

第二步的 `x-layout` 输入框直接编辑 `ModelDraft.layout`，不是编辑完整模型 Schema。
草稿与 Schema 的转换必须双向保留布局：

```ts
interface ModelDraft {
  // 既有字段省略
  groups: GroupDraft[];
  layout: AfUiNode;
}

function draftToSchema(draft: ModelDraft): ModelSchema {
  return {
    // 其他 Schema 字段省略
    "x-layout": draft.layout,
  };
}

function schemaToDraft(schema: ModelSchema): ModelDraft {
  return {
    // 其他草稿字段省略
    layout: schema["x-layout"],
  };
}
```

新建草稿的 `layout` 必须使用 §2.2 的默认 `filter + table` JSON；
编辑模型时必须从后端 Schema 读取 `x-layout` 并回显。若后端 Schema 缺少
`x-layout`，编辑页报协议错误，不自动补默认值。

---

## 3. 运行时注册：RegisterDescribe 与 IConfig

### 3.1 类型骨架

```ts
interface RegisterDescribe {
  ui?: Record<string, UIComponentDescribe>; // component 名 → tsx 实现（+ 可选 slots）
  services?: ServiceDescribe[]; // 具名服务（唯一数据访问入口，见 §4.1）
  constant?: Record<string, unknown>; // 常量表（取代 enums）
  form?: {
    components?: Record<string, FormComponentDescribe>; // 直接进 FormProvider.components
    decorators?: Record<string, FormDecoratorDescribe>; // 直接进 FormProvider.decorators
    handlers?: Record<string, RuntimeRuleHandler>; // 直接进 createForm.handlers（复用 core 类型）
  };
}

// 每个域导出一个工厂，runtime 注入以便访问 service / constant 等
export type IConfig = (runtime: RuntimeCore) => RegisterDescribe;
```

`RegisterDescribe.constant` 是全局和模型域都可注册的静态数据资源。全局注册放置平台通用值，
模型域可以增加或覆盖同名常量；常量不负责请求、不包含 React 组件、不产生 Schema。

全局常量至少提供以下基础选项：

```ts
const globalConstant = {
  gender: [
    { label: "男", value: "male" },
    { label: "女", value: "female" },
    { label: "未知", value: "unknown" },
  ],
  grades: [
    { label: "一年级", value: "grade-1" },
    { label: "二年级", value: "grade-2" },
    { label: "三年级", value: "grade-3" },
    { label: "四年级", value: "grade-4" },
    { label: "五年级", value: "grade-5" },
    { label: "六年级", value: "grade-6" },
  ],
};
```

form/filter 的 Schema 通过 `$af_scope_constant.gender` 和 `$af_scope_constant.grades`
读取这些值；UI 组件通过 `useScope()` 或 `useConstant()` 读取同一份对象。

其中：

```ts
interface UIComponentDescribe {
  Component: React.ComponentType<UINodeProps>; // 渲染实现
  slots?: string[]; // 容器暴露的具名槽（叶子组件可省略）
}

interface UINodeProps {
  props: Record<string, unknown>; // 来自 AfUiNode.props
  children: AfUiNode[]; // 用 <RenderNode> / <Slot> 渲染
  ctx: PageContext; // schema / compiled / model / runtime / page
}
```

### 3.2 form.\* 直接透传 alien-form（无需自造）

- `form.components` → 合并进 `FormProvider` 的 `components`。
- `form.decorators` → 合并进 `FormProvider` 的 `decorators`。
- `form.handlers` → 透传给 `createForm({ handlers })`，Schema 里用 `"@name"` 调用。

唯一落地接缝：`packages/shared` 新增中性的 **`RuntimeResourceContext`**（仅一个容器，不含 RuntimeCore）：

```ts
interface RuntimeResource {
  components?: Record<string, unknown>;
  decorators?: Record<string, unknown>;
  handlers?: Record<string, unknown>;
  scope?: Record<string, unknown>;
}
```

`SchemaRenderer`（现状吃死 `fieldComponents / fieldDecorators`、未透传 `scope / handlers`）改为读取该
context 并 merge 后交给 `useCreateForm({ schema, initialValues, scope, handlers })` 与
`FormProvider`。`apps` 层用 RuntimeCore 填充该 context。**这是打通「form 直接注册」的唯一必要改动。**

---

## 4. 作用域注入：`$af_scope_*` 扁平键

alien-form 表达式求值器的标识符规则为 `/[A-Za-z_$][A-Za-z0-9_$]*/`（含 `_`，不含 `-`）。
因此协议采用**下划线扁平键**，让 form 表达式与 UI 组件**两层消费完全一致**（同名 key、同种读法）：

```ts
// runtime 生成唯一一份 scope 对象
const afScope = {
  $af_scope_service: (id: string) => runtime.service.query(id), // 取具名 service，见 §4.1
  $af_scope_constant: runtime.constant.all(), // 只读常量表
  $af_scope_t: runtime.i18n?.t,
  $af_scope_router: runtime.router,
};
```

两处消费：

- **alien-form 表达式 / 规则**（经 `createForm.scope` 注入）：
  ```js
  $af_scope_service("records.list")?.send({ model, filters });
  $af_scope_constant.MAX_UPLOAD;
  ```
- **UI 组件**（`useRuntime()` / `useScope()` 返回同一个 `afScope`）：
  ```ts
  const s = useScope();
  s.$af_scope_service("records.list")?.send({ model, filters });
  s.$af_scope_constant.MAX_UPLOAD;
  ```

> 不用命名空间对象、不用连字符：连字符键无法作为裸标识符出现在表达式中；下划线键两层皆可直接引用。

`constant` 一份数据两个出口（`$af_scope_constant` 与 `useConstant()`），走 global/domain 两级合并。
全局常量由 `register/global/index.ts` 注册；当前基础模型至少使用 `gender`、`grades`
这两个常量，禁止在模型 Schema 或 UI 组件中重复硬编码同一组选项。

### 4.1 数据访问统一经 services（唯一入口）

**alien-form 与所有 `$af-ui` 组件的一切接口请求，都必须经注册的 services，禁止业务代码直连 fetch / apiSend / record-service。**

service 句柄与调用形态（三段收敛为两段，去掉 bindCtx 柯里化）：

```ts
interface ServiceDescribe {
  code: string; // service id，如 "records.list" / "schema.get" / "auth.login"
  send: (params?: unknown, options?: unknown) => Promise<unknown>;
}

// 统一调用：取用器返回句柄，可选链后 send
$af_scope_service("records.list")?.send({ model, filters, pagination });
```

内置 global services（由 `register/global/index.ts` 预注册，取代原 `src/services` 的请求函数）：

| service code                                                                       | 取代的旧函数                          |
| ---------------------------------------------------------------------------------- | ------------------------------------- |
| `records.list`                                                                     | `listRecords`（`POST /records/list`） |
| `records.get`                                                                      | `getRecord`                           |
| `records.create`                                                                   | `createRecord`                        |
| `records.update`                                                                   | `updateRecord`                        |
| `records.delete`                                                                   | `deleteRecord`                        |
| `records.deleteMany`                                                               | `deleteRecords`                       |
| `schema.get` / `schema.list` / `schema.create` / `schema.update` / `schema.delete` | `getSchema` 等                        |
| `auth.login` / `auth.logout`                                                       | `login` / `logout`                    |

两条数据路径都必须改走 services：

1. **编译期**：`SchemaCompilerContext.request` 语义不变（仍是 `RequestFn`），但 app 层传入的实现改为内部调
   `runtime.service.query("records.list").send(...)`。因此 `$af-dataSource` 的 `ctx.request(...)` 底层即 service，
   **不保留旧匿名 request 入口**；编译器的 request 上下文必须改为 service resolver。
2. **运行期**：`FieldServiceContext`（现注入匿名 `RequestFn`）升级为注入 `scope`（含 `$af_scope_service`）；
   `useAsyncOptions` 内部直接使用 `$af_scope_service("records.list")?.send(...)`。

`$af-dataSource` marker 可显式声明所用 service（缺省 `records.list`）：

```jsonc
{
  "plugin": "$af-dataSource",
  "service": "records.list",
  "model": "school-role",
  "label": "roleName",
  "value": "id",
}
```

**域内定制**：模型定制的功能注册到对应域（如 `register/school-user/services/*`）；
域内 service 与 global 同名时覆盖 global。这里的“覆盖”只针对 service code，
不意味着可以绕过服务契约或直接调用 transport。

---

## 5. RuntimeCore（精简单例）

对齐参考原型，裁剪到本项目所需，保留骨架与命名习惯：

```ts
export default class RuntimeCore {
  static get current(): RuntimeCore; // 未初始化则抛错

  readonly ui: MD_UI; // UI 注册表（global / domain 两级）
  readonly service: MDService; // 服务注册（薄封装 apiSend / record-service）
  readonly constant: MDConstant; // 常量注册（取代 enum）
  readonly form: MDForm; // { components, decorators, handlers } 汇总
  router?: Router;

  // 注册
  registerGlobal(d: RegisterDescribe): void;
  registerDomain(d: RegisterDescribe, domain: string): void;
  clearDomainRegister(domain: string): void;

  // 消费
  resolveLayout(modelCode: string, schemaLayout?: AfUiNode): AfUiNode; // §2.1 优先级
  get scope(): Record<string, unknown>; // §4 的 afScope（domain ∪ global）
}
```

保留 / 裁剪对照（相对参考原型）：

| 参考原型                                         | 本项目                                                     | 说明                          |
| ------------------------------------------------ | ---------------------------------------------------------- | ----------------------------- |
| `RuntimeCore` 单例 + `current`                   | 保留                                                       | 注册表与全局能力宿主          |
| global / domain / scene 三级作用域               | **仅 global + domain**                                     | `scene` 预留接口，首版不实现  |
| services / ui / enums / constants / utils / form | **ui / services / constant / form**                        | 去 utils；enums 并入 constant |
| 8 个 parser plugin                               | 复用现有 `SchemaCompiler`（`$af-i18n` / `$af-dataSource`） | 不重造解析管线                |
| `IConfig = (runtime) => RegisterDescribe`        | 保留                                                       | 每域导出的工厂签名            |

---

## 6. 目录结构与自动收集

和 `domains` 同级新增 `runtime/`（核心）与 `register/`（能力包）：

```text
apps/alien-cms/src/
├── domains/                       # 页面/业务（现状）
├── runtime/                       # 运行时核心（新）
│   ├── RuntimeCore.ts             # 单例 + 注册/清理 + scope + resolveLayout
│   ├── describe.ts                # RegisterDescribe / IConfig / AfUiNode 类型
│   ├── types.ts                   # 原 src/services/types.ts 下沉：Pagination/Sorter/ModelRecord/RecordListParams/...
│   ├── transport.ts              # 原 api-client 保留为独立底层 transport（apiGet/apiSend），仅供 service 内部使用
│   ├── MD_UI.ts                   # UI 注册表（global / domain）
│   ├── MDService.ts               # 服务注册（query(id) → { code, send }）
│   ├── MDConstant.ts              # 常量注册
│   ├── MDForm.ts                  # form.components / decorators / handlers 汇总
│   ├── DataScope.ts               # signal 化数据域（§8）
│   ├── PageRuntime.ts             # 页面实例：持有若干 DataScope
│   └── react.ts                   # useRuntime / useScope / useConstant / RenderNode / Slot
└── register/                      # 每域一个能力包（新，和 domains 同级）
    ├── index.ts                   # 顶层：唯一的 glob('./*/index.ts') 收集所有域
    ├── global/
    │   ├── index.ts               # 【唯一必需文件】默认导出一个 IConfig
    │   └── ...                     # 内置 services、constant、UI 与 form 资源，开发者自行组织并手动 import
    └── {model}/                   # 如 school-user：域内定制资源
        ├── index.ts               # 【唯一必需文件】默认导出一个 IConfig
        └── ...                     # 同上，自由拆分、手动汇总进 index.ts
```

> **`src/services` 删除说明**：原 `src/services` 的请求函数（`record-service` / `schema-service` / `auth-service`）
> 全部下沉为 `register/global` 的内置 services（§4.1）；纯类型（`Pagination` / `Sorter` / `ModelRecord` /
> `RecordListParams` / `RecordListResult` 等）下沉到 `runtime/types.ts`；底层裸 fetch（`api-client`）保留为
> `runtime/transport.ts`，**仅供 service 内部实现调用，业务层禁止直接 import**。原先 13 处对 `../services` 的
> import 相应改指 `runtime/types`（取类型）或改为经 `$af_scope_service` / `useRuntime()` 取数（取请求）。

**约束（重要）**：

- 每个域下**唯一强制的文件是 `index.ts`，且只 `export default` 一个 `IConfig`**。
- `ui / form / services / constant` **不是**规定的目录结构，也**不做子目录 glob**——
  是否拆分、拆成什么目录/文件，完全由开发者按代码量自行决定，并在 `index.ts` 里**手动 import 后组装**进 `IConfig` 返回值。
- 框架**只**在顶层 `register/index.ts` 做一次 `glob('./*/index.ts')`；子层不扫描。

收集流程（顶层唯一一次 `import.meta.glob`，`eager: true`）：

1. `register/index.ts` 用 `glob('./*/index.ts')` 拿到每个域的默认导出 `IConfig`。
2. 对每个域执行 `config(runtime)` 得到 `RegisterDescribe`：
   `global` → `registerGlobal(desc)`；其余目录名即 `modelCode` → `registerDomain(desc, modelCode)`。
3. 解析布局与组件时：`domain 表 ∪ global 表`，**域内同名覆盖全局**；支持 `clearDomainRegister`。

`register/{model}/index.ts` 形态示例——**子文件由开发者手动 import 并组装**：

```ts
import type { IConfig } from "../../runtime/describe";
// 开发者按需自行拆分与导入（目录结构不受框架约束）：
import { CustomTree } from "./ui/custom-tree";
import { loginService } from "./services/login";
import { constants } from "./constant";

const config: IConfig = (runtime) => ({
  ui: { tree: { Component: CustomTree } }, // 域内组件；缺省复用 global
  services: [loginService],
  constant: constants, // 覆盖 global 同名
  form: { components: {}, decorators: {}, handlers: {} },
});

export default config; // 域内唯一对外导出
```

> 布局只来自后端 Schema 的 `x-layout`；`register/{model}` 只注册该域允许使用的实现与资源，不得定义或覆盖布局。

---

## 7. 树表数据源（后端零改动）

树数据源极简：**在 `school-user` 增加一个 `parentCode` 字段**，与已有 `userNo`（`unique + index + filterable`）自连成层级链。

层级示例（五级）：

```text
校长(学校层, parentCode=null)
  └─ 学院领导(parentCode=校长userNo)
       └─ 年级主任(parentCode=学院领导userNo)
            └─ 班主任(parentCode=年级主任userNo)
                 └─ 学生(parentCode=班主任userNo)
```

数据流：

1. `$af-ui` 的 `tree` 组件拉取节点数据（大 pageSize 或仅取 `userNo / parentCode / displayName`），
   按 `parentCode → userNo` 在前端拼成树；套 antd `Tree` + 搜索框（按 label 过滤，命中自动展开）。
2. 选中节点 → 前端遍历算出该节点**子树内所有 `userNo`** 集合。
3. 向数据域注入锁定过滤 `filters: { userNo: [...] }`。
4. 后端 `POST /api/records/list` 对**数组值天然走 `IN`**（`record-repo.ts` 现有逻辑），
   **过滤引擎 / list 接口 / DDL 全部零改**。

要点：`parentCode` 甚至无需 `filterable`（只用于前端拼树）；真正打到后端的是本来就 filterable 的 `userNo IN [...]`。
唯一改动是**新增一个字段声明 + 重排 seed 数据**（纯配置/数据，不碰引擎）。

### 7.1 组织独立成 `school-department` 模型（部门 / 班级 / 党团）

`school-user` 的自连接人链只适合「人挂在人下」的场景；一旦需要「随时新建部门/班级」「学部下
建独立于学生结构的党团组织」「学生同时属于班级和团委/学生会」，人链就要塞占位人节点、且无法表达
一个学生属于多个组织。因此把「组织结构」独立成 `school-department` 模型（自身也是一棵 `parentCode`
自连接树，复用 §7 的树表机制），`school-user` 不变。

模型字段（详见 `apps/alien-server/src/schemas/school-department.ts`）：

| 字段                | 语义                     | 存储                                                              |
| ------------------- | ------------------------ | ----------------------------------------------------------------- |
| `deptCode`          | 部门编码（树的连接键）   | text，`unique + index + filterable`                               |
| `deptType`          | 学部/年级/班级/党团组织  | text，`filterable`                                                |
| `parentCode`        | 上级部门的 `deptCode`    | **普通文本列**，`index + filterable + nullable`（学部为 null 森林根） |
| `homeroomTeacherId` | 班主任（仅班级）         | `many-to-one → school-user`                                       |
| `creatorId`         | 创建者（必须是教师）     | `many-to-one → school-user`，`index`                             |
| `memberIds`         | 学生成员（班级/党团均可）| `many-to-many → school-user`（junction 表）                      |

三条硬约束：

1. **父级选择用 `TreeSelect`（新增组件）。** `parentCode` 的连接键是业务编码 `deptCode` 而非记录
   `id`，因此**不能挂 `$af-dataSource`**——否则 `field-plan` 会把它推断成指向 `id` 的外键（FK ON，
   写入被拒）。取数配置改放在字段 `props`（`treeModel / treeIdField / treeLabelField / treeParentField`），
   由 `TreeSelect` 通过 `records.list` 自取并按 `parentField → idField` 拼树，回填 `deptCode`；
   组件同时排除「自身及其子树」避免选成自己的父级形成环。`TreeSelect` 落在 `packages/shared` 组件
   注册表（与 `Select` 同层，自取逻辑复用 `useServiceResolver()`），过 `check:boundaries`。
2. **创建者/班主任必须是教师。** `creatorId` 必填指向 `school-user`；班主任只对班级有意义。语义由
   seed 数据与前端取值范围保证（本轮范围只含班主任 + 学生，不含任课老师）。
3. **学生可属于多个组织。** `memberIds` 是多对多：班级放本班学生，团委/学生会放跨班学生，一个学生
   可同时出现在自己的班级与若干党团组织的成员集里。

树导航布局（`schoolDepartmentLayout`）与 §7 同构，但多传一个 `tree` 组件 prop：

```jsonc
{ "component": "tree", "props": {
  "model": "school-department", "idField": "deptCode",
  "parentField": "parentCode", "labelField": "deptName",
  "targetField": "deptCode", "publishTo": "main",
  "hideLeaf": false          // 班级/党团是叶子但必须可点选；缺省 true 用于隐藏 school-user 树的学生叶子
}}
```

> `tree` 组件原逻辑丢弃无子节点的叶子（隐藏用户树里的学生）。部门树里班级/党团本身就是叶子，
> 必须保留 → 新增 `hideLeaf` 开关（缺省 `true` 保持用户树行为，部门布局显式传 `false`）。

数据链路整套通过 `scripts/seed.js` 灌入（`school-department` 组排在 `school-user` 之后满足 FK 依赖），
**后端引擎零改动**；本轮唯一的应用代码改动是新增模型 schema（schema-as-code，进 `builtinSchemas`）、
新增 `TreeSelect` 组件、以及 `tree` 组件的 `hideLeaf` 开关。


`tree` 组件的 `props` 约定：

```ts
interface TreeProps {
  model?: string; // 缺省 = 页面主模型
  idField: string; // 节点自身标识，如 "userNo"（已 filterable）
  parentField: string; // 上级标识，如 "parentCode"
  labelField: string; // 展示字段，如 "displayName"
  searchable?: boolean; // antd Tree + 搜索框
  publishTo: string; // 目标数据域 id，如 "main"
  targetField: string; // 用哪个字段 IN 过滤表格，如 "userNo"
  includeSelf?: boolean; // 子树是否含节点自身
  hideLeaf?: boolean; // 是否丢弃无子节点的叶子（缺省 true：隐藏用户树的学生叶子；部门树传 false）
  defaultSelect?: "root" | "first" | "none";
}
```

---

## 8. 响应式管线：DataScope

节点树里「树选中 → 表格过滤」不靠 props 逐层传递，而经**具名数据域 DataScope**（signal 化），
由 `PageRuntime`（每页面实例一个）持有若干 DataScope 并注入 `PageContext`。

```ts
class DataScope {
  id: string; // "main" 等
  model: string; // 缺省 = 页面主模型

  // 多来源过滤：tree / filter 各写各的 key，computed 合并
  private sources = signal<Record<string, object>>({}); // { tree:{userNo:[...]}, filter:{...} }
  readonly filters = computed(() => Object.assign({}, ...Object.values(this.sources())));

  pagination = signal<{ current: number; pageSize: number }>({ current: 1, pageSize: 10 });
  sorter = signal<Sorter | undefined>(undefined);
  selection = signal<string[]>([]);

  setFilterPatch(source: string, patch: object) {
    startBatch();
    this.sources({ ...this.sources(), [source]: patch });
    this.pagination({ ...this.pagination(), current: 1 }); // 改筛选回第一页
    endBatch();
  }
  // crud：create / update / remove / removeMany / refresh（内部只调用已注册的 records.* services）
}
```

- `tree` 选中 → `scope.setFilterPatch("tree", { userNo: [...] })`。
- `filter` 提交 → `scope.setFilterPatch("filter", values)`。
- `table` 内部 `useSignalValue(scope.filters)`：filters / pagination / sorter 任一变 → React Query key 变 → 自动重查。
- `filters` 是 `computed`，合并逻辑声明一次；React 桥接复用现有 `useSignalValue`，不写新订阅机制。

多面板（未来主从表 / 看板）可开多个 DataScope；节点通过 `props.scope`（缺省 `"main"`）绑定数据域。

---

## 9. 渲染主流程

```text
应用启动
  → new RuntimeCore()
  → registerGlobal(global/index.ts)                        // 注册基础 UI/form/service/constant 资源
  → 遍历 register/{model}/index.ts → registerDomain(config(runtime), modelCode)

进入 /records/:model
  → useRecordPage(model) → { schema, compiled }
  → RuntimeCore.current.resolveLayout(model, compiled.layout)   // 校验并解析 Schema.x-layout
  → new PageRuntime(compiled)                                    // 建 DataScope("main") 等
  → <RenderNode node={layout} ctx={{ schema, compiled, runtime, page }} />
容器节点 → MD_UI.get(component) → 渲染 children 与 slots 进具名插槽
       数据节点 → 绑定 scope，useSignalValue 消费 compiled 物料 → React Query 取数
       动作节点 → 落 slot，操作 scope.crud / scope.selection
       未注册 component → 抛出协议错误
```

---

## 10. 两种布局的协议实例

### 10.1 默认布局（模型构建器模板）

新建模型时，模型构建器第二步的 `x-layout` 编辑器默认填充：

```jsonc
{
  "plugin": "$af-ui",
  "component": "page",
  "children": [
    { "plugin": "$af-ui", "component": "filter", "props": { "scope": "main" } },
    {
      "plugin": "$af-ui",
      "component": "table",
      "props": { "scope": "main" },
      "slots": {
        "toolbarLeft": [{ "plugin": "$af-ui", "component": "action-batch-delete" }],
        "toolbarRight": [
          { "plugin": "$af-ui", "component": "action-refresh" },
          { "plugin": "$af-ui", "component": "action-add" },
        ],
      },
      "children": [
        {
          "plugin": "$af-ui",
          "component": "row-actions",
          "children": [
            { "plugin": "$af-ui", "component": "detail" },
            { "plugin": "$af-ui", "component": "edit" },
            { "plugin": "$af-ui", "component": "delete" },
          ],
        },
      ],
    },
  ],
}
```

### 10.2 树表布局（treelayout 三插槽）

```jsonc
{
  "plugin": "$af-ui",
  "component": "treelayout",
  "slots": {
    "tree": [
      {
        "plugin": "$af-ui",
        "component": "tree",
        "props": {
          "model": "school-user",
          "idField": "userNo",
          "parentField": "parentCode",
          "labelField": "displayName",
          "searchable": true,
          "publishTo": "main",
          "targetField": "userNo",
          "includeSelf": true,
          "defaultSelect": "root",
        },
      },
    ],
    "filter": [{ "plugin": "$af-ui", "component": "filter", "props": { "scope": "main" } }],
    "table": [
      {
        "plugin": "$af-ui",
        "component": "table",
        "props": { "scope": "main" },
        "slots": {
          "toolbarLeft": [{ "plugin": "$af-ui", "component": "action-batch-delete" }],
          "toolbarRight": [
            { "plugin": "$af-ui", "component": "action-refresh" },
            { "plugin": "$af-ui", "component": "action-add" },
          ],
        },
        "children": [
          {
            "plugin": "$af-ui",
            "component": "row-actions",
            "children": [
              { "plugin": "$af-ui", "component": "detail" },
              { "plugin": "$af-ui", "component": "edit" },
              { "plugin": "$af-ui", "component": "delete" },
            ],
          },
        ],
      },
    ],
  },
}
```

> `treelayout` 固定暴露 `tree`、`filter`、`table` 三个插槽；table 固定暴露
> `toolbarLeft`、`toolbarRight` 两个 toolbar 插槽，`rowActions` 才放在 table 的 `children` 中。

---

## 11. 首批实现范围

| 类别     | component                                                                                   | 说明                                          |
| -------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 容器     | `page` / `treelayout`                                                                       | 布局，暴露具名槽                              |
| 数据视图 | `table` / `filter` / `tree`                                                                 | 消费 `compiled.columns / filter`；tree 拼层级 |
| 动作     | `action-add` / `action-batch-delete` / `action-refresh` / `row-actions`(detail/edit/delete) | 操作绑定的 DataScope                          |

暂缓（接口预留）：`tabs` / `export` / `kanban` / `scene` 作用域 / 多 DataScope 主从联动。

---

## 12. 边界守护清单

- **shared 纯净**：RuntimeCore / register / UI 插件全在 `apps/alien-cms`；
  shared 仅加 `AfUiNode` 类型、`Compiled.layout` 指针、中性 `RuntimeResourceContext`；
  不出现业务标识符，继续过 `scripts/check-architecture.mjs`。
- **signal 单一出口**：signal 原语一律从 `@alien-form/core` 取（已 re-export），不新增 `alien-signals` 直接依赖。
- **数据访问单一入口**：一切请求经注册的 services（`$af_scope_service(id)?.send(...)`）；
  删除 `src/services`，请求函数下沉 `register/global`，裸 fetch 收敛到 `runtime/transport.ts`，
  **业务层与 UI 组件禁止直接 import `apiSend` / `record-service`**。
- **后端零改动**：树表复用 `filters` 的 `IN` 语义；唯一数据侧改动是 `school-user` 增 `parentCode` 字段 + seed 重排。
- **Schema 只读**：register 不生产 Schema，只提供 `component` 名的合法实现与资源。

---

## 附：与既有实现的接缝索引

| 接缝          | 现状位置                                                                               | 改动                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| form 资源注入 | `packages/shared/src/components/SchemaRenderer.tsx`                                    | 读 `RuntimeResourceContext`，merge `components/decorators/handlers/scope`                               |
| 布局透传      | `packages/shared/src/compiler/types.ts`（`Compiled`）                                  | 增 `layout: AfUiNode`，布局缺失或非法直接报错                                                           |
| 编译期取数    | `apps/alien-cms/src/compiler/create-compiler.ts`（`appRequest`）                       | 改为通过 service resolver 调 `records.list`，删除匿名 request 适配                                      |
| 组件自取数    | `packages/shared/src/components/service.ts`（`FieldServiceContext`/`useAsyncOptions`） | 注入从匿名 `RequestFn` 升级为 `scope`；内部改走 `$af_scope_service("records.list")?.send`               |
| services 删除 | `apps/alien-cms/src/services/*`                                                        | 请求函数 → `register/global` services；类型 → `runtime/types.ts`；`api-client` → `runtime/transport.ts` |
| 页面渲染      | `apps/alien-cms/src/domains/record/pages/list.tsx`                                     | 由固定 JSX 改为 `resolveLayout` + `<RenderNode>`                                                        |
| 页面状态      | `apps/alien-cms/src/domains/record/hooks/use-record-page.ts`                           | 抽出 CRUD/查询到 `PageRuntime` + `DataScope`                                                            |
| 信号桥接      | `packages/react/src/index.tsx`（`useSignalValue`）                                     | 直接复用，不改                                                                                          |
| 树字段        | `apps/alien-server/src/schemas/school-user.ts` + `scripts/seed.js`                     | 增 `parentCode` 字段 + seed 层级数据                                                                    |
