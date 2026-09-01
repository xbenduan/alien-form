# Alien-MDM v1 开发文档

> 全新应用 `alien-mdm-v1`，稳定后整体替换现 `alien-mdm`。
>
> **两个真相源**：①协议 [schema.tsx](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx)；②[系统重构分析](file:///Users/bytedance/Documents/cowork/alien-form/docs/system-refactor-analysis.zh-CN.md)里**已拍板的决定与架构**。v1 **吸收这些决定与架构，但从零实现——不以现** **`alien-mdm`/`packages/engine`/`packages/react`** **的代码为实现蓝本**（不迁入、不照搬、不对照行号）。现有代码只作为"曾经趟过的坑"的背景，不作为落地依据。
>
> **关键约束**：v1 **只依赖** **`@alien-form/core`** **一个包**。分析文档里的 engine（编译器+运行时+注册中心）与 react 桥接层，其**设计**被吸收，其**实现**在 v1 内新写，分别落在 `src/engine`、`src/binding`。core 需一组前置改造（见 §9），是 v1 第 0 步。

---

## 0. 从分析文档吸收的已拍板决定

以下决定直接采纳，作为 v1 的设计前提（**采纳结论，不采纳其现有实现**）：

| 决定                                              | 采纳形态（v1）                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| 一个 page = 一个 core form                        | 动态页面 = 一份 alien-form schema → 一个 `createForm` 实例                  |
| `{{ }}` + `new Function`，`compileExpr` 归属 core | 表达式唯一语法；编译器在 core，v1 只依赖 core 即可渲染                      |
| 命名空间对象点访问                                | `$service.xxx` / `$utils.xxx` / `$enums.xxx` / `$query.xxx` / `$values.xxx` |
| 放弃 scope 通信频道                               | 跨组件联动只走 `form + $values`（signal 响应式）                            |
| `$ref` 纯静态引用                                 | 只指向 `definitions`，编译期展开，永不含表达式                              |
| antd 优先                                         | antd 全量注入渲染组件表；仅"调接口/带副作用"才自研组件                      |
| filter 值字符串化 JSON                            | 不引入 `x-format:"json"` 简写，组件内部自理 parse/stringify                 |
| 三层注册自动发现                                  | `global → overrides → {modelCode}`（保留此**架构**，实现新写）              |
| void 语义：数据上浮、渲染不浮                     | `type:"void"` 不占 `form.values`，渲染归属由父插槽控制                      |

> 分析文档里**只与"改造旧包"相关**的条目（删 `packages/builder`、断 engine→react 反向依赖、`domains/model` 只留 UI、`constant→enums` 全链路改名等）在 v1 语境下不适用——v1 是新工程，不存在这些历史包袱；仅吸收其背后的**设计取向**（如 enums 命名、注册中心两级 namespace）。

---

## 1. 目标与边界

| 项         | 决策                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新应用     | `apps/alien-mdm-v1`，与 `alien-mdm` 并存，稳定后替换                                                                                                                                                                    |
| **包依赖** | **仅** **`@alien-form/core`** + antd + react-router；engine/binding 为 app 内新写源码                                                                                                                                   |
| 路由       | **静态页面**（手写 React：`pages/home`、`pages/auth`、`pages/model`）+ **动态页面**（引擎按 schema 渲染的 records）                                                                                                     |
| model 域   | **静态、手写**：配置化构建模型；列表页与 records 列表观感一致（**模型 meta 即 table columns，可 filter**）；新增/编辑页**手写构建、用 alien-form**                                                                      |
| records 域 | **动态**：按模型 schema 由引擎渲染（list/add/edit/detail）                                                                                                                                                              |
| 组件放置   | **无 ui/form 之分**：全部是 alien-form 组件，统一 `runtime.component` 注册，放 `register/global/components/**`（按 `fields`/`layouts`/`pages`/`antd` 分子目录，仅组织用途）；能用 antd 就挂 antd，仅组合/带副作用才自研 |

---

## 2. 目录结构（alien-mdm-v1）

```
apps/alien-mdm-v1/src/
├── engine/                       # 【框架大脑 · app 内新写】只依赖 @alien-form/core
│   ├── compiler/                 #   构建时：schema → 可执行页面模型（调 core.compileExpr AOT）
│   ├── runtime/                  #   运行时：AppRuntime / PageRuntime(=一个 core form) / scope 装配
│   ├── registry/                 #   注册中心（两级 namespace：global + domain）
│   └── protocol/                 #   协议类型（XPage / FieldSchema / BuilderSchema）
├── binding/                      # 【React 桥接层 · app 内新写】依赖 engine + core
│   ├── form-renderer.tsx         #   FormRenderer / SchemaField / FieldSlot / useField*
│   ├── page-provider.tsx         #   PageProvider / usePage / 动态页面渲染入口
│   ├── runtime-provider.tsx      #   RuntimeProvider / useRuntime
│   └── use-atom.ts               #   signal→React（useSyncExternalStore 桥）
│
├── app/                          # 应用装配
│   ├── bootstrap/main.tsx        #   createRoot + RuntimeProvider + AntdApp + AppRouter
│   ├── providers/                #   全局 Provider（antd ConfigProvider / Auth / 主题…）
│   └── router/
│       ├── index.tsx             #     <AppRouter>（BrowserRouter + 鉴权壳）
│       ├── static-routes.tsx     #     静态路由：home / auth / model
│       └── dynamic-routes.tsx    #     动态路由：records（URL → 引擎页面）
│
├── pages/                        # 【静态页面】手写 React
│   ├── home/                     #   首页/工作台
│   ├── auth/                     #   登录/鉴权
│   └── model/                    #   模型配置化构建（§5）：list(表格+filter) / add / edit
│
├── register/                     # 【注册中心】三层自动发现（§3），runtime 来自 src/engine
│   ├── index.ts                  #   registerAll：global → overrides → {modelCode}
│   ├── global/
│   │   ├── index.ts              #   registerGlobal 汇总（components + services + enums）
│   │   ├── components/           #   全部 alien-form 组件（统一 runtime.component）
│   │   │   ├── fields/           #     收值字段（Input/Select/Object…），meta 带协议信息
│   │   │   ├── layouts/          #     布局/展示/交互（layout/filter/table/tree）
│   │   │   ├── pages/            #     页面级壳（record-page/overlay）
│   │   │   └── antd.ts           #     直接挂载的 antd 组件
│   │   ├── services/             #   $service 数据源
│   │   └── enums.ts              #   $enums 常量
│   └── overrides/                #   使用者全局覆盖层（无 domain）
│
├── runtime/                      # 引擎实例装配（薄）
│   ├── create-runtime.ts         #   new Runtime(@engine) + registerAll
│   ├── transport.ts              #   HTTP client
│   └── types.ts                  #   app DTO
└── utils/                        # register-ui-component / register-field-component 等
```

> **命名**：`src/binding` = "schema/signal → React 的桥接层"。可改名 `src/renderer` 或 `src/react`，全仓一致即可。本文用 `src/binding`。
>
> **为何内嵌 engine/binding**：v1 只依赖 `@alien-form/core`。把 engine/binding 作为 app 新写源码，既拿到协议渲染能力，又不引入外部框架包的版本耦合。两者**照分析文档 §1.2/§1.3 的设计新写**，不从 `packages/engine`/`packages/react` 搬运代码。builder（可视化建模 runtime）v1 不需要——model 域用手写 + alien-form（§5）。

---

## 3. 路由：静态 vs 动态

三个静态域（home / auth / model）+ 一个动态域（records）。

### 3.1 静态页面（手写 React）

```tsx
// app/router/static-routes.tsx
const HomePage = lazy(() => import("../../pages/home"));
const LoginPage = lazy(() => import("../../pages/auth/login"));
const ModelListPage = lazy(() => import("../../pages/model/list"));
const ModelAddPage = lazy(() => import("../../pages/model/add"));
const ModelEditPage = lazy(() => import("../../pages/model/edit"));

export const publicRoutes: RouteMeta[] = [{ path: "/login", component: LoginPage }];
export const staticRoutes: RouteMeta[] = [
  { path: "/", component: HomePage },
  { path: "/models", component: ModelListPage },
  { path: "/models/add", component: ModelAddPage },
  { path: "/models/:modelCode/edit", component: ModelEditPage },
];
```

鉴权壳：`publicRoutes` 直达，其余走受保护壳（未登录 `Navigate` 到 `/login`）。

### 3.2 动态页面（引擎按 schema 渲染，records 域）

一条 catch-all 把 URL 交给引擎：URL → 匹配某模型的 `x-pages[].router` → 取 `x-page` → 建 `PageRuntime`（= 一个 core form）→ `FormRenderer` 渲染。

```tsx
// app/router/dynamic-routes.tsx
<Route path="/records/:modelCode/*" element={<DynamicPage />} />

function DynamicPage() {
  const { modelCode } = useParams();
  const rest = /* modelCode 之后的段，如 "" / "add" / "edit/123" */;
  return <PageRoute modelCode={modelCode} routerSegment={rest} />;
}
```

- 静态路径段（`list`/`add`/`edit/{...}`）由协议 `x-page.router` 声明（[schema.tsx:47](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L47)）。

- 动态参数（`?keyword=`、`?id=`）不进路由参数，由 `$query.xxx` 在表达式里读（[schema.tsx:104](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L104)、[:171](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L171)）。

> **判定规则**：model 域（造模型）= 静态手写；records 域（用模型）= 动态协议渲染。

---

## 4. 注册架构（吸收三层自动发现的设计）

采纳"三层优先级自动发现"这一**架构决定**（实现在 v1 新写，`Runtime` 来自 `src/engine`）。优先级由低到高：

1. **global**（`register/global/**`）——框架基线，使用者不改。`registerGlobal` 汇总 components / services / enums。
2. **overrides**（`register/overrides/index.ts`）——使用者全局覆盖，无 domain，同 code `last-write-wins`。
3. **{modelCode}**（`register/{modelCode}/index.ts`）——模型定制，`domain = 目录名`，`import.meta.glob("./*/index.ts", { eager:true })` 自动发现；渲染时优先取 domain 覆盖、回退 global。

```ts
// register/index.ts
import type { Runtime } from "@engine";
export function registerAll(runtime: Runtime): void {
  registerGlobal(runtime); // 1. 基线
  registerOverrides(runtime); // 2. 全局覆盖
  for (const [path, mod] of Object.entries(modelModules)) {
    // 3. 模型定制
    const domain = domainOf(path);
    if (RESERVED_DIRS.has(domain)) continue;
    mod.default?.(runtime, domain);
  }
}
```

注册入口保持**极简且一致**——组件不再分 ui / form / page 三类 API，**全都是 alien-form 组件，走同一个** **`runtime.component`**；目录只用来归类，不改变注册方式。runtime 只暴露三个方法：

| 注册对象                                | API（统一）                                     | 归属目录（仅组织用途）                                                         |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| 组件（字段/布局/展示/页面壳/antd…全部） | `runtime.component({ code, component, meta? })` | `global/components/**`（子目录任意分组，如 `fields`/`layouts`/`pages`/`antd`） |
| 数据源                                  | `runtime.service({ code, send })`               | `global/services`                                                              |
| 常量/枚举                               | `runtime.constant(key, value)`                  | `global/enums.ts`                                                              |

- **无 ui/form 之分**：`Input`、`Table`、`layout`、`record-page`、antd `Button` 在注册与解析上完全同类，`component` 字符串走同一个两级 namespace 解析（domain 优先、回退 global）。

- **`meta?`** **可选**：字段类组件可带 `meta`（`type`/`kind`/`dataSource`/联动投影等协议信息），布局/展示/antd 组件通常不带——同一 API、按需给 `meta`，不为此拆出多个注册函数。

- **runtime 保持简单**：不引入 `formDecorator`/`ui`/`registerFieldComponent`/`registerUiComponent` 等分叉入口，只有 `component`/`service`/`constant` 三个。

---

## 5. 组件放置规范

所有组件都是 alien-form 组件，**统一用** **`runtime.component`** **注册**，目录只用于归类。`register/global/components/` 下按用途分子目录（纯组织，不影响注册与解析）：

```
register/global/components/
├── index.ts        # 汇总：把各子目录组件全部 runtime.component 注册
├── fields/         # 收值字段（Input/Select/NumberInput/ObjectField/ArrayCards…），meta 带 type/kind/联动投影
├── layouts/        # 布局/展示/交互（layout/filter/table/tree 等组合类）
├── pages/          # 页面级壳（record-page/overlay）
└── antd.ts         # 直接挂载的 antd 组件（Flex/Space/Card/Row/Col/Divider/Button/Table…）
```

### 5.1 统一注册示例

```ts
// register/global/components/index.ts
import type { Runtime } from "@engine";
import { registerAntd } from "./antd";
import * as fields from "./fields";
import * as layouts from "./layouts";
import * as pages from "./pages";

export function registerComponents(runtime: Runtime): void {
  registerAntd(runtime); // antd 组件（无 meta）
  // 字段：带协议 meta
  runtime.component({
    code: "Input",
    component: fields.Input,
    meta: { type: "string", kind: "leaf", dataSource: false },
  });
  runtime.component({
    code: "Select",
    component: fields.Select,
    meta: { type: "string", kind: "leaf", dataSource: true },
  });
  runtime.component({
    code: "Object",
    component: fields.Object,
    meta: { type: "object", kind: "complex", children: "properties" },
  });
  // 组合类布局/展示：通常无 meta
  runtime.component({ code: "layout", component: layouts.Layout });
  runtime.component({ code: "filter", component: layouts.Filter });
  runtime.component({ code: "table", component: layouts.Table });
  runtime.component({ code: "tree", component: layouts.Tree });
  // 页面壳
  runtime.component({ code: "record-page", component: pages.RecordPage });
  runtime.component({ code: "overlay", component: pages.Overlay });
}
```

```ts
// register/global/components/antd.ts —— antd 组件同样走 runtime.component
import { Flex, Space, Card, Row, Col, Divider, Button, Table, Typography } from "antd";
import type { Runtime } from "@engine";

const ANTD: Record<string, React.ComponentType<any>> = {
  Flex,
  Space,
  Card,
  Row,
  Col,
  Divider,
  Button,
  Table,
  Title: Typography.Title,
  Text: Typography.Text,
};
export function registerAntd(runtime: Runtime): void {
  for (const [code, component] of Object.entries(ANTD)) runtime.component({ code, component });
}
```

- **字段类**给 `meta`（`type`/`kind`/`dataSource`/`children`/联动投影）——它承载 `onChange → $values`、`x-reaction`/`x-format`/`dataSource` 协议钩子，内部用 antd 控件实现。

- **布局/展示/页面壳/antd** 一般不给 `meta`，就是普通渲染组件。

- **能用 antd 就用 antd**：`Flex`/`Space`/`Card`/`Button`… 直接挂；仅"组合 + 带副作用"（`table` loadData、`filter` stringify、行 `delete` 调 service）才自研，放 `layouts/`。

### 5.2 `layout` 组件用 antd `Layout` 实现（尽量少写样式，观感对齐现版本）

现版本是 flex——左栏 `280px`（min `240`）/ 主区列向堆叠 / `gap:16` / `min-height:520`，`left` 缺省时退化为纵向 stack。v1 用 antd `Layout`+`Sider`+`Content` 表达同一形态，只用少量 inline 样式，不新增 CSS module：

```tsx
// register/global/components/layouts/layout.tsx
import { Layout as AntLayout } from "antd";
import { RenderNode, type ComponentProps } from "@binding";

const GAP = 16;

/** 左栏 + 右上 + 右下三插槽；left 为空时右栏占满（退化为纵向堆叠）。 */
export function Layout({ node, children }: ComponentProps) {
  const { left, rightTop, rightBottom } = node.slots ?? {};

  const main = (
    <AntLayout.Content
      style={{
        display: "flex",
        flexDirection: "column",
        gap: GAP,
        minWidth: 0,
        background: "transparent",
      }}
    >
      {rightTop && <RenderNode node={rightTop} />}
      {rightBottom && <RenderNode node={rightBottom} />}
      {children as React.ReactNode}
    </AntLayout.Content>
  );

  if (!left) return main; // 无 left：纵向 stack

  return (
    // 有 left：左右分栏
    <AntLayout
      hasSider
      style={{ gap: GAP, minHeight: 520, minWidth: 0, background: "transparent" }}
    >
      <AntLayout.Sider
        width={280}
        theme="light"
        style={{ minWidth: 240, background: "transparent" }}
      >
        <RenderNode node={left} />
      </AntLayout.Sider>
      {main}
    </AntLayout>
  );
}
```

> `background:transparent` 抵掉 antd `Sider`/`Content` 默认深色底；`280/240/16/520` 沿用现版本，除这几处 inline 外不写额外样式。`Sider` 自带 `breakpoint` 可替代 media query 断点。

### 5.3 schema 里如何引用

`component` 字符串按 registry 两级解析（domain 优先、回退 global）；antd 与自研走同一通道：

```jsonc
{
  "type": "void",
  "component": "Flex",
  "properties": {
    "add": {
      "type": "void",
      "component": "Button",
      "props": { "children": "新增", "onClick": "{{ () => $service.router.go('add') }}" },
    },
    "refresh": { "type": "void", "component": "Button", "props": { "children": "刷新" } },
  },
}
```

---

## 6. model 域（静态、手写、用 alien-form）

"配置化构建模型"的工具页，手写 React，不走引擎协议；表单渲染复用 alien-form（core `createForm` + binding `FormRenderer` + `register/global/components/fields` 字段）。

### 6.1 列表页 `pages/model/list`（观感对齐 records 列表）

- **表格 + filter**，与 records 列表一致。

- **模型 meta 即 table columns**：模型定义（字段清单）直接映射为表格列。

- **可 filter**：顶部筛选区按 meta 字段生成过滤条件，调建模 list service 取模型清单。

```tsx
function ModelListPage() {
  const columns = metaToColumns(modelMeta); // 模型 meta → 表格列
  const [filter, setFilter] = useState<ModelFilter>({});
  const { data } = useModelList(filter); // 调 schema.list service
  return (
    <Card>
      <ModelFilterBar meta={modelMeta} value={filter} onChange={setFilter} />
      <Table rowKey="modelCode" columns={columns} dataSource={data} />
    </Card>
  );
}
```

### 6.2 新增/编辑页 `pages/model/add`、`pages/model/edit`（手写 + alien-form）

- **手写页面骨架**（分区/步骤、保存按钮），表单主体用 **alien-form**：把"模型编辑表单"描述成一份 alien-form schema，交给 binding `FormRenderer`。

- 复用 `register/global/components/fields` 字段（`Input`/`Select`/`ArrayCards`…），联动用 `x-reaction` + `$values`。

```tsx
import { createForm } from "@alien-form/core";
import { FormRenderer } from "@binding";
import { modelEditSchema } from "./model-edit-schema"; // 手写的 alien-form schema

function ModelAddPage() {
  const form = useMemo(
    () =>
      createForm({
        schema: modelEditSchema,
        scope: { $service, $utils, $enums }, // 命名空间注入
      }),
    [],
  );
  const onSave = async () => {
    const values = await form.submit();
    // 编码为 BuilderSchema：字段结构必须落在 definitions['form-schema']（见 §6.3）
    const builderSchema = encodeModel(values); // 产出 { meta, "x-pages", definitions }
    await $service.schema.create(builderSchema);
  };
  return (
    <PageShell onSave={onSave}>
      <FormRenderer form={form} components={registry.components} />
    </PageShell>
  );
}
```

> model 域不需要 builder runtime（撤销/重做/命令派发）——core form 响应式 + 手写页足够。若后续要拖拽式可视化搭建，再引入 builder。

### 6.3 建模产物契约：`definitions['form-schema']` 是后端建表的唯一真相源（强约束）

协议改版后，模型的**字段结构**不再散落在页面各处，而是收敛到 `BuilderSchema.definitions['form-schema']`（见 [schema.tsx:180-189](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L180)）——list/add/edit 等页面都通过 `$ref: "form-schema"` 复用它（[schema.tsx:101](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L101)、[:116](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L116)、[:157](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L157)、[:171](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L171)）。

**因此后端建表直接读** **`{model}.definitions['form-schema'].properties`，而非解析页面/`x-pages`。** 每个 property 即一列，`type` + 字段级元信息（如 `x-database`/`x-table`）决定列类型/约束。

**前端硬约束**——`pages/model/add`（以及 edit）在提交时**必须**保证：

1. `definitions['form-schema']` **一定存在**，且是模型字段结构的**唯一**落点；创建模型时此路径不可缺省、不可为空。
2. `form-schema.properties` 里的每个字段是**纯 JSON Schema 结构**（`type` + 字段元信息），**不含表达式**（`{{ }}` 只出现在页面 props/联动，绝不进 `form-schema`）——对齐"`$ref` 纯静态引用"决定。
3. `x-pages` 里对字段结构的引用**一律用** **`$ref: "form-schema"`**，不得内联复制字段定义，避免多处结构漂移。

```jsonc
// $service.schema.create 收到的 BuilderSchema（后端据此建表）
{
  "meta": { "name": "_sys_models", "title": "模型管理" },
  "x-pages": [
    /* list/add/edit：字段处一律 { "$ref": "form-schema" } */
  ],
  "definitions": {
    "form-schema": {
      // ← 后端建表唯一真相源，必存在
      "properties": {
        "name": {
          "type": "string",
          "title": "模型名称",
          "x-database": { "column": "name", "length": 128 },
        },
        "status": { "type": "string", "title": "状态", "x-database": { "column": "status" } },
      },
    },
  },
}
```

> `encodeModel(values)` 的职责就是把手写表单的收集值编码成上面的 `BuilderSchema`，并**保证** **`definitions['form-schema']`** **被填充**——这是前后端之间的建表契约，编码器里应有断言/校验，缺失即报错、不允许提交。字段级的 DB 元信息（列名/长度/索引/唯一约束等）以 `x-database`（或约定的字段扩展键）承载，随字段一起进 `form-schema`。

---

## 7. 协议映射：schema 字段 → 渲染行为（records 动态页）

真相源 [schema.tsx](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx)。

| 协议字段       | 语义                | 渲染侧行为                                                 |
| -------------- | ------------------- | ---------------------------------------------------------- |
| `type` 非 void | 收值输入源          | 组件 `onChange` 写回 `$values[path]`                       |
| `type:"void"`  | 布局/展示/操作容器  | 不占 `form.values`，仍在字段树、由父插槽渲染               |
| `component`    | 组件名              | registry 两级解析（所有组件同一通道）                      |
| `props`        | 组件参数 + 具名插槽 | 插槽值为同级 `properties` 字段名                           |
| `properties`   | 字段树              | void 子节点数据上浮、渲染归属由父插槽控制                  |
| `{{ }}`        | 表达式              | `compileExpr` 编译为 `(scope)=>value`                      |
| `$ref`         | 静态结构引用        | 指向 `definitions`，编译期展开，永不含表达式               |
| `x-reaction`   | 联动规则            | `{{ ({ $values }) => ({ visible: … }) }}`                  |
| `x-format`     | 值序列化            | core `input`/`output` 变换钩子（filter JSON 组件内部自理） |
| `dataSource`   | 选项源              | `{{ $enums.status }}` 或 service                           |

三组件联动（tree/filter/table，[schema.tsx:82-146](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L82-L146)）：`filter`/`tree` 写 `$values` → `table` 的 `props.filter={{ $values.filter }}`、`props.nodeId={{ $values.tree }}` 重算 → table 内部监听变化调 `loadData`。**联动只靠 form+$values，无 scope、无 bus。**

### 7.1 级联依赖字段（省 / 市 / 区）

三个**独立收值字段**（各占 `$values` 一个路径），靠 `{{ $values.x }}` 相互驱动，无需 scope/联动配置：市的选项依赖省的值、区的选项依赖市的值。

**约定**：异步/联动选项统一走字段的 `dataSource`（而非塞进 `props.options`）。`dataSource` 是"取数声明"——一个表达式，值可为同步数组，也可为 `Promise`；组件内部用 `useDataSource(dataSource)` 消费，拿到 `{ data, loading, error }`（等价于 `useQuery` 的返回）。

```jsonc
{
  "properties": {
    // 省
    "province": {
      "type": "string",
      "component": "Select",
      "title": "省",
      "dataSource": "{{ $service.query.province() }}",
    },
    // 市：dataSource 依赖 $values.province；province 空则不请求（短路成 []）
    "city": {
      "type": "string",
      "component": "Select",
      "title": "市",
      "dataSource": "{{ !$values.province ? [] : $service.query.city({ province: $values.province }) }}",
    },
    // 区：dataSource 依赖 $values.city
    "district": {
      "type": "string",
      "component": "Select",
      "title": "区",
      "dataSource": "{{ !$values.city ? [] : $service.query.district({ city: $values.city }) }}",
    },
  },
}
```

**组件侧（binding 的 Select）**：core 已移除 `dataSourcePolicy`，"选项变化时如何处置已选值"改由 **Select 自己的 props** 定义（如 `onOptionsChange:"preserve"|"clear"|"first"`，默认 `clear`）。

```tsx
// Select 内部：dataSource 已被编译/求值为 数组 或 Promise，交给 useDataSource 归一
function Select({ value, onChange, dataSource, onOptionsChange = "clear", ...rest }: FieldProps) {
  const { data = [], loading, error } = useDataSource(dataSource); // ≈ useQuery 返回
  // 选项变化后的处置策略：由组件 props 决定（取代 core 的 dataSourcePolicy）
  useEffect(() => {
    if (loading || value == null) return;
    const stillValid = data.some((o) => o.value === value);
    if (stillValid || onOptionsChange === "preserve") return;
    if (onOptionsChange === "first") onChange(data[0]?.value);
    else onChange(undefined); // "clear"
  }, [data, loading, value, onChange, onOptionsChange]);
  return (
    <AntSelect
      value={value}
      onChange={onChange}
      options={data}
      loading={loading}
      status={error ? "error" : undefined}
      {...rest}
    />
  );
}
```

**运行机制（三点必须成立）**：

1. **表达式随** **`$values`** **重算**：`city.dataSource` 编译成 `(scope)=>...`，内部读了 `$values.province`；province 变化时 signal 触发重算——这是 core 收紧 scope + `compileExpr` 的直接收益，字段间联动零配置。
2. **`useDataSource`** **归一同步/异步**：`dataSource` 求值结果可能是数组（同步、如 `$enums` 或短路的 `[]`）或 `Promise`（内联 `$service.query.city({...})` 调用返回的 `send(...)`）。`useDataSource` 统一处理：thenable 则进 `loading`、resolve 填 `data`、reject 填 `error`；数组则直接 `data`、`loading:false`。**组件只认** **`{ data, loading, error }`，不关心同步还是异步。**
3. **父变清子（组件 props 决定，非 core）**：省改变 → 市的 `dataSource` 重算并重新取数 → 新 `data` 不含旧的市值 → Select 按自己的 `onOptionsChange` 策略处置（默认 `clear` 置空、`first` 取首项、`preserve` 保留）。core **不再**内建 `dataSourcePolicy`；策略权归组件。

> 为什么放 `dataSource` 而不是 `props.options`：`dataSource` 是协议既有字段（[schema.tsx:42](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx#L42)），语义就是"选项/数据来源"；options 是组件渲染用的**结果**。把"取数声明"和"渲染结果"分开，组件才能用 `useDataSource` 统一接管 loading/error/防抖/缓存，schema 只声明来源。两种 `$service` 写法仍成立：`{{ $service.query.city }}`（工厂，组件自己决定何时调）vs `{{ $service.query.city({...}) }}`（当场调、给 Promise）——级联场景用后者最直观。

---

## 8. 命名空间与数据流

| 命名空间       | 来源                                             | 语义                                                                          |
| -------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `$service.xxx` | `register/global/services`（`runtime.service`）  | 异步服务，返回**未调用**函数；dotted code 两级访问（`$service.records.list`） |
| `$utils.xxx`   | `runtime.fn`                                     | 同步纯函数，返回未调用函数                                                    |
| `$enums.xxx`   | `register/global/enums.ts`（`runtime.constant`） | 枚举/常量，扁平 key 直映射                                                    |
| `$query.xxx`   | 当前 URL 查询参数                                | 外部输入通道（深链接/刷新保持）                                               |
| `$values.xxx`  | 当前 form 字段值                                 | 组件间联动唯一桥梁                                                            |

> service code 采用 dotted 命名（`records.list`/`schema.get`/`auth.*`），点访问用两级解析。协议保留未调用工厂语义：`{{ $service.records.list }}` 传给组件，组件内部 `props.loadData(params)`。数据请求留组件内部，不进 `form.values`。

---

## 9. 渲染管线（app 侧装配）

```
main.tsx
  → const runtime = createAppRuntime()          // new Runtime(@engine) + registerAll(runtime)
  → <RuntimeProvider runtime={runtime}>          // @binding
      <AntdApp>
        <AppRouter>
          静态 → 手写 React（pages/home、pages/auth、pages/model）
                   └ model 的 add/edit 内部用 core createForm + @binding FormRenderer
          动态 → <DynamicPage> → PageRuntime(=一个 core form) → <FormRenderer/>（@binding）
```

`FormRenderer.components` 由 registry 提供（含全量 antd）。engine/binding 全部 app 内新写，外部包依赖只有 `@alien-form/core`。

---

## 10. core 前置改造（v1 依赖项）

v1 协议渲染依赖 core 一组前置改造。详见 [system-refactor-analysis.zh-CN.md §1.1](file:///Users/bytedance/Documents/cowork/alien-form/docs/system-refactor-analysis.zh-CN.md)：

1. **`compileExpr`** **归属 core**（最关键）。core 内置 `compileExpr(raw) => (scope)=>unknown`（`new Function`，隐式 `()=>expr`、含 `=>` 即函数工厂），兼具编译 + 执行。删除旧受限求值器 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts)（禁止函数调用，协议跑不了）。**对 v1 尤其关键**：正因 `compileExpr` 在 core，v1 才能只依赖 core 完成协议渲染，`src/engine` 只是构建期复用它做 AOT 预编译。
2. **rule 调用统一为单参** **`(scope)`**。删旧 `(runtime, form)` 分支；编译后的 fn 只吃 scope（`$form`/`$self` 已在 scope 内）。
3. **删除** **`@handler`** **与** **`FormConfig.handlers`**。handler 即 `{{ $utils.name }}`。
4. **收紧** **`buildExpressionScope`** **为闭合形状**：`{ $values, $self, $form, $value, $row, $path, $service, $utils, $enums, $query }`，去掉旧 `...values`/兄弟扁平上浮。v1 协议一律 `{{ $values.x }}` 读，正依赖闭合形状。
5. **`config.scope`** **= 命名空间注入缝**（非被删的通信频道 scope）。v1 的 `create-runtime`/PageRuntime、model 域手写表单，都通过它注入 `$service/$utils/$enums/$query`。
6. **移除** **`dataSourcePolicy`**。core 不再内建"选项变化时如何处置已选值"（`preserve/clear/first`）——这是组件呈现策略。core 只保留 `dataSource`；父变清子等由 Select 组件用自己的 props 决定（见 §7.1）。

> core 改造（含单测）是 v1 **第 0 步**，排在所有 app 步骤之前。

---

## 11. 施工步骤

1. **core 前置改造**（§10）：`compileExpr` + 单参 rule + 删 `@handler` + 闭合 scope；core 单测先过。
2. **搭壳**：`apps/alien-mdm-v1` 脚手架（vite + tsconfig 别名 `@engine`/`@binding`/`@runtime`/`@utils`/`@components`/`@app-types`），依赖仅 `@alien-form/core` + antd + react-router。
3. **新写 engine**：`src/engine`（compiler/runtime/registry/protocol），照分析文档 §1.2/§3/§4 **设计**从零实现；只依赖 `@alien-form/core`。
4. **新写 binding**：`src/binding`（FormRenderer/PageProvider/RuntimeProvider/useAtom），照 §1.3/§5 设计新写；依赖 engine + core。
5. **runtime 装配**：`runtime/create-runtime.ts`（`new Runtime`（@engine）+ `registerAll`）、`transport.ts`、`types.ts`。
6. **注册骨架**：`register/index.ts`（三层自动发现）+ `global/index.ts`；接通空的 components/services/enums。
7. **antd 挂载**：`components/antd.ts` 批量 `runtime.component` 挂 antd 组件。
8. **字段组件**：`components/fields/` 实现起步字段集（带 `meta`）。
9. **组合组件**：`components/layouts/` 仅 `layout`/`filter`/`table`/`tree`；纯布局/按钮用 antd。
10. **页面壳组件**：`components/pages/` 的 `record-page`/`overlay` 等。
11. **services / enums**：建模与记录相关 service + 枚举常量。
12. **静态页面**：`pages/home`、`pages/auth`；**`pages/model`（list 表格+filter / add·edit 手写 + alien-form，§6）**。
13. **动态路由**：catch-all `/records/:modelCode/*` → `DynamicPage` → 引擎按 `x-pages[].router` 渲染。
14. **walking skeleton**：先打通 model 域（建一个模型），再打通该模型 records `list` 动态页（schema→编译→form→FormRenderer→tree/filter/table 联动）。
15. **铺开**：records `add`/`edit`/`detail` 动态页、其余模型；`overrides/` 与 `{modelCode}/` 定制样例各一。
16. **切换**：验收通过后入口切到 alien-mdm-v1，下线旧 alien-mdm。
