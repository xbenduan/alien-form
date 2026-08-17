# 场景驱动的组件架构

> 目标：一份 Schema 配置一次，在编辑、详情、表格和筛选四个场景中投影并渲染。
> shared 维护通用组件能力与场景解析，app 维护 CMS 业务元数据和投影规则。

## 1. 当前分层

场景驱动能力分为两层：

| 层级       | 位置                                           | 职责                                                                   |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| 通用渲染层 | `packages/shared/src`                          | Adapter 定义、场景能力表、resolver、通用 Form/Filter/Table/Detail 组件 |
| 应用投影层 | `apps/alien-cms/src/domains/record/projection` | 解释 `x-cms`、遍历业务 Schema、生成 shared 所需 projection             |

模型构建与 CMS Schema 类型位于
`apps/alien-cms/src/domains/model`。它们属于应用业务，不进入 shared。

依赖方向固定为：

```text
core schema
    ↓
shared adapter / resolver / scene components
    ↑
alien-cms model metadata and record projections
```

shared 只接收 core 的 `IFieldSchema`、通用 projection、handlers 和 actions，不读取
`x-cms`，也不依赖应用 Provider、CRUD 或模型类型。

## 2. Schema 契约

公开 Schema 使用以下容器语义：

- `x-layout`：无值布局节点，例如 `SectionCard`、`GridLayout`、`FlexLayout`。
- `type: "object"`：对象值。
- `type: "array"`：数组值；对象数组由 `items.properties` 描述。
- 其他 `type`：标量或 tags 等叶子字段。

布局节点只通过 `x-layout` 声明。公开 Schema、shared resolver 和组件目录不提供
`type: "void"` 兼容分支。

应用扩展 `x-cms` 继续按业务场景保存配置：

```ts
interface CmsFieldUiMeta {
  form?: { modes?: Array<"add" | "edit"> };
  detail?: { format?: string };
  filter?: {
    visible?: boolean;
    operator?: string;
    component?: string;
    props?: Record<string, unknown>;
  };
  table?: {
    visible?: boolean;
    order?: number;
    width?: number;
    ellipsis?: boolean;
    format?: string;
    inline?: string[];
    expandable?: boolean;
  };
  mobile?: Record<string, unknown>;
}
```

`x-cms` 由 app 投影层消费。投影完成后传给 shared 的字段 Schema 不再携带该业务键。

## 3. Adapter 场景能力

通用 Adapter 契约位于
`packages/shared/src/adapter/adapter.ts`：

```ts
export type AdapterScene = "form" | "detail" | "filter" | "table";

export type SceneMode = "edit" | "readonly" | "cell" | "filter";

export interface SceneVariant {
  mode?: SceneMode;
  renderAs?: string;
  props?: Record<string, unknown>;
  operator?: string;
  summary?: boolean;
}

export type SceneEntry = string | SceneVariant;
export type SceneMap = Partial<Record<AdapterScene, SceneEntry>>;
```

每个 Adapter 在定义处声明参与哪些场景，以及是否委托给另一个 Adapter：

```ts
export default defineAdapter(Select, {
  key: "Select",
  label: "下拉选择组件",
  description: "下拉选择组件。",
  kind: "component",
  meta: { fieldType: "string" },
  scenes: {
    form: {},
    filter: { operator: "in" },
    detail: "DisplayChoice",
    table: { renderAs: "DisplayChoice", summary: true },
  },
});
```

`renderAs` 只做一跳委托，避免递归映射造成不可预测的解析链。

## 4. Scene Resolver

通用解析入口位于
`packages/shared/src/adapter/scene-resolver.ts`：

```ts
export function resolveSceneRender(
  field: IFieldSchema,
  scene: AdapterScene,
  catalog: AdapterCatalogItem[],
  override?: SceneRenderOverride,
): ResolvedSceneRender | undefined;
```

解析顺序：

1. 优先使用 `field.component`，其次使用 `field["x-layout"]`。
2. 两者都不存在时，按公开字段类型推导默认 Adapter。
3. 查找 Adapter 的 `scenes[scene]`；未声明则返回 `undefined`。
4. 应用一跳 `renderAs`。
5. mode 使用 override、场景声明、场景默认值的优先级。
6. props 按场景默认值、字段 props、app override 的顺序合并。
7. operator 和 summary 由 app override 覆盖 Adapter 默认声明。

默认 mode：

| scene    | mode       |
| -------- | ---------- |
| `form`   | `edit`     |
| `detail` | `readonly` |
| `filter` | `filter`   |
| `table`  | `cell`     |

resolver 返回 `trace`，记录起始 Adapter、`renderAs` 和显式 override，便于解释渲染决策。

## 5. App 投影职责

### 5.1 表单与详情

`apps/alien-cms/src/domains/record/projection/scene-schema.ts`：

- 按 add/edit/detail mode 处理字段可见性。
- 将 `x-cms` 场景配置转换为 resolver override。
- 递归生成只包含 core/shared 契约的 Schema。
- 布局节点保留 `x-layout`，不转换为字段类型。

shared 的 `SchemaForm` 根据 mode 选择 form 或 detail 场景组件表。

### 5.2 筛选

`apps/alien-cms/src/domains/record/projection/filter.ts`：

- 展开 `object`、对象数组和 `x-layout` 的子字段。
- 仅生成可筛选叶子字段。
- 基本类型数组作为叶子字段保留。
- 合并动态 data source 与 `x-cms.filter` override。
- 输出 `FilterProjection`，由 shared `SchemaFilter` 渲染。

### 5.3 表格

`apps/alien-cms/src/domains/record/projection/table.ts`：

- 将字段投影为 `TableColumnProjection`。
- 读取列顺序、宽度、可见性、格式、摘要字段和展开能力。
- 标量列通过 resolver 选择 Display Adapter。
- `object`、`array` 和 `x-layout` 使用 shared 的专用摘要逻辑与详情入口。

shared 不解释列偏好或 CMS 元数据，只消费完整的列 projection。

## 6. 组件表生成

`buildSceneComponents` 根据 Adapter catalog 生成指定场景的组件表；
`buildRenderableScenes` 在此基础上为 React 组件注入 mode 和场景默认 props。

```ts
const formComponents = buildRenderableScenes(adapters, "form");
const detailComponents = buildRenderableScenes(adapters, "detail");
const filterComponents = buildRenderableScenes(adapters, "filter");
```

新增组件时只需：

1. 在 `packages/shared/src/adapters` 定义组件及其 `scenes`。
2. 从 adapters 出口显式导出并纳入 registry。
3. 在 app 模型编辑器需要暴露该组件时，使用 shared catalog 元数据。

消费端不维护 form/detail/filter/table 的手写降级映射。

## 7. 复杂类型边界

| 场景   | 处理方式                                                            |
| ------ | ------------------------------------------------------------------- |
| form   | `object` 使用容器组件，对象数组使用 `ArrayCards` 或 `EditableTable` |
| detail | 容器只读渲染，对象数组使用只读数组组件                              |
| filter | app 投影层展开容器，仅将叶子字段交给 shared                         |
| table  | 标量使用 Display Adapter，复杂值使用 object/array 摘要和详情入口    |

resolver 返回 `undefined` 表示当前 Adapter 未声明该场景，调用方可进入明确的专用渲染分支。

## 8. 当前文件清单

| 文件                                            | 作用                                           |
| ----------------------------------------------- | ---------------------------------------------- |
| `packages/shared/src/adapter/adapter.ts`        | Adapter、SceneMap、catalog 与 registry         |
| `packages/shared/src/adapter/scene-resolver.ts` | 场景解析和组件表生成                           |
| `packages/shared/src/adapters`                  | 通用输入、展示、布局和数组组件                 |
| `packages/shared/src/scenes/form`               | form/detail 场景渲染                           |
| `packages/shared/src/scenes/filter`             | 通用筛选表单渲染                               |
| `packages/shared/src/scenes/table`              | 通用表格单元格与复杂值摘要                     |
| `packages/shared/src/components`                | SchemaForm、SchemaFilter、SchemaTable 组合组件 |
| `apps/alien-cms/src/domains/model`              | CMS Schema、Builder 与模型元数据               |
| `apps/alien-cms/src/domains/record/projection`  | form/detail/filter/table 业务投影              |

## 9. 约束总结

- core 定义 Schema 与表单运行时。
- shared 定义通用 Adapter 和场景渲染契约。
- app 定义 CMS 元数据、Provider 和业务投影。
- `x-layout` 是公开布局节点的唯一表达。
- `x-cms` 不越过 app 到 shared 的边界。
- 场景降级在 Adapter 定义处声明，业务差异通过 app override 注入。
