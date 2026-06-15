# @alien-form/cms

> AlienForm 的 CMS 核心包。
> 它提供模型 Schema、数据 Provider、异步 CRUD API、场景投影工具和 Builder 辅助函数，帮助你用一份 Schema 驱动模型管理、记录管理、筛选、表格和详情页。

`@alien-form/cms` 不依赖 React，也不管理 UI 状态。它刻意保持为“纯异步 API + 纯投影函数 + Provider 抽象”，让应用层可以自由选择 React Query、Zustand、Redux、SWR 或任意状态管理方案。

## 特性

- **模型 Schema**：在 `@alien-form/core` 的 `IFormSchema` 之上扩展 `x-model` 和 `x-cms`。
- **Provider 抽象**：统一本地内存 Demo 和远程 HTTP 后端。
- **CRUD API**：提供 Schema 与 Record 的增删改查函数。
- **场景投影**：把同一份模型 Schema 投影为表格列、筛选字段和场景渲染配置。
- **Adapter 元数据**：组件可以声明自己在表单、详情、表格、筛选、Builder 中的渲染策略。
- **Handler 元数据**：运行时 handler 可以声明参数、目标和默认配置，供 Builder 使用。
- **Builder 工具**：支持从可视化草稿构建模型 Schema，也支持把 Schema 还原为草稿。

## 安装

```bash
pnpm add @alien-form/cms @alien-form/core
```

## 什么时候使用

如果你只需要一个动态表单运行时，使用 `@alien-form/core` 即可。

当你需要这些能力时，使用 `@alien-form/cms`：

- 管理一组业务模型 Schema。
- 根据模型 Schema 生成记录列表、记录表单、详情页和筛选器。
- 在本地 Demo Provider 和远程 REST Provider 之间切换。
- 为组件库建立“场景能力目录”。
- 构建一个可视化模型搭建器。

## 快速开始：本地 Provider

`createProviders()` 在没有 `baseUrl` 时会创建本地内存 Provider，并默认注入 Demo 数据。

```ts
import { createProviders } from "@alien-form/cms";

const providers = createProviders();

const schemas = await providers.schemaProvider.list();
const records = await providers.recordProvider.list({
  model: "nailBooking",
  pagination: { current: 1, pageSize: 10 },
});

const health = await providers.healthCheck();
```

## 快速开始：HTTP Provider

传入 `baseUrl` 后，`createProviders(config)` 会创建 HTTP Provider。

```ts
import { createProviders } from "@alien-form/cms";

const providers = createProviders({
  version: "1.0",
  name: "Production CMS",
  baseUrl: "https://api.example.com",
  options: {
    timeout: 10000,
    headers: {
      Authorization: "Bearer token",
    },
  },
});

const schema = await providers.schemaProvider.detail({
  modelName: "product",
});
```

HTTP 模式下 Provider 会通过内部 `HttpClient` 请求远程 REST API，并可通过 `adapter` 配置适配分页、排序、筛选和响应路径。

## Provider 管理

除了直接使用 `createProviders()`，包内还提供一套基于注册表和 `localStorage` 缓存的 Provider 管理 API。

```ts
import {
  initProvider,
  registerProvider,
  switchProvider,
  resetProvider,
  LocalRecordProvider,
  LocalSchemaProvider,
} from "@alien-form/cms";

registerProvider("local", (config) => ({
  schema: new LocalSchemaProvider(config),
  record: new LocalRecordProvider(config),
}));

registerProvider("custom", (config) => ({
  schema: createCustomSchemaProvider(config),
  record: createCustomRecordProvider(config),
}));

initProvider((config) => ({
  schema: new LocalSchemaProvider(config),
  record: new LocalRecordProvider(config),
}));

switchProvider("custom", {
  baseUrl: "https://api.example.com",
});

resetProvider();
```

管理 API 适合浏览器应用：

- `initProvider(localFactory)`：初始化 Provider 系统，优先读取缓存，失败时回退本地 Provider。
- `registerProvider(type, factory)`：注册 Provider 工厂。
- `switchProvider(type, config)`：切换 Provider，并写入 `localStorage`。
- `resetProvider()`：清空缓存并回到本地 Provider。
- `getCurrentProviderType()`：读取当前缓存中的 Provider 类型。
- `getCurrentProviderSnapshot()`：读取当前缓存快照。

## Schema API

Schema API 会调用当前已初始化的 `SchemaProvider`。

```ts
import {
  createSchema,
  deleteSchema,
  getSchema,
  initProvider,
  listSchemas,
  updateSchema,
} from "@alien-form/cms";

initProvider(createLocalProviderFactory);

const result = await listSchemas({
  keyword: "booking",
  pagination: { current: 1, pageSize: 20 },
});

const schema = await getSchema("booking");

await createSchema({
  type: "object",
  title: "预约",
  "x-model": {
    name: "booking",
    title: "预约",
  },
  properties: {},
});

await updateSchema("booking", schema);
await deleteSchema("booking");
```

### Schema API 列表

| API | 说明 |
| --- | --- |
| `listSchemas(params?)` | 查询模型摘要列表。 |
| `getSchema(modelName)` | 查询单个模型完整 Schema。 |
| `createSchema(schema)` | 创建模型 Schema。 |
| `updateSchema(modelName, schema)` | 全量更新模型 Schema。 |
| `deleteSchema(modelName)` | 删除模型 Schema。 |

## Record API

Record API 会调用当前已初始化的 `RecordProvider`。

```ts
import {
  batchDeleteRecords,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
} from "@alien-form/cms";

const page = await listRecords({
  model: "booking",
  filters: {
    status: "pending",
  },
  pagination: { current: 1, pageSize: 10 },
  sorter: { field: "createdAt", order: "descend" },
});

const detail = await getRecord("booking", "record-id");

const created = await createRecord("booking", {
  customerName: "Ada",
});

await updateRecord("booking", created.data!.id, {
  customerName: "Grace",
});

await deleteRecord("booking", created.data!.id);
await batchDeleteRecords("booking", ["id-1", "id-2"]);
```

### Record API 列表

| API | 说明 |
| --- | --- |
| `listRecords(params)` | 查询记录列表，支持筛选、分页和排序。 |
| `getRecord(model, id)` | 查询单条记录。 |
| `createRecord(model, values)` | 创建记录。 |
| `updateRecord(model, id, values)` | 更新记录。 |
| `deleteRecord(model, id)` | 删除记录。 |
| `batchDeleteRecords(model, ids)` | 批量删除；Provider 不支持时会顺序删除。 |

## 模型 Schema

`CmsModelSchema` 继承自 `@alien-form/core` 的 `IFormSchema`，并增加 `x-model` 元信息。

```ts
import type { CmsModelSchema } from "@alien-form/cms";

const productSchema: CmsModelSchema = {
  type: "object",
  title: "商品",
  description: "商品主数据模型",
  "x-model": {
    name: "product",
    title: "商品",
    singularLabel: "商品",
    pluralLabel: "商品",
    primaryField: "name",
    defaultPageSize: 20,
    openMode: {
      add: "drawer",
      edit: "drawer",
      detail: "drawer",
    },
    actions: {
      row: ["edit", "detail", "delete"],
      toolbar: ["add", "refresh"],
      batch: ["delete"],
    },
  },
  properties: {
    name: {
      type: "string",
      title: "商品名称",
      required: true,
      component: "Input",
      "x-cms": {
        table: {
          width: 240,
          ellipsis: true,
          visible: true,
        },
        filter: {
          visible: true,
          operator: "contains",
          defaultVisible: true,
        },
      },
    },
    status: {
      type: "string",
      title: "状态",
      component: "Select",
      dataSource: [
        { label: "上架", value: "online" },
        { label: "下架", value: "offline" },
      ],
      "x-cms": {
        table: {
          width: 120,
          format: "status",
        },
        filter: {
          visible: true,
          operator: "eq",
        },
      },
    },
  },
};
```

## `x-model`

`x-model` 描述模型级元信息：

| 字段 | 说明 |
| --- | --- |
| `name` | 模型唯一名称。 |
| `title` | 模型标题。 |
| `subtitle` | 副标题。 |
| `description` | 描述。 |
| `singularLabel` / `pluralLabel` | 单数和复数显示名。 |
| `primaryField` | 主显示字段。 |
| `filter.count` | 默认筛选项数量。 |
| `table.width` | 默认表格宽度。 |
| `table.visible` | 默认可见列。 |
| `defaultPageSize` | 默认分页大小。 |
| `openMode` | `add`、`edit`、`detail` 的打开方式：`modal`、`drawer`、`page`。 |
| `actions` | 行操作、批量操作和工具栏操作配置。 |

## `x-cms`

`x-cms` 描述字段在 CMS 多场景中的行为：

| 分支 | 说明 |
| --- | --- |
| `table` | 表格列宽、格式化、可见性、内联字段、摘要展开等。 |
| `filter` | 是否参与筛选、操作符、默认可见、筛选组件 props。 |
| `form` | 新增/编辑表单中的模式配置。 |
| `detail` | 详情场景格式化配置。 |
| `mobile` | 移动端卡片标题、副标题、标签、优先级等。 |
| `reactions` | Builder 侧为 handler reaction 保存的参数配置。 |

## 场景投影

### `projectTableColumns(schema)`

把模型 Schema 投影为表格列配置。

```ts
import { projectTableColumns } from "@alien-form/cms";

const columns = projectTableColumns(productSchema);
```

返回项包含：

```ts
{
  key: string;
  title: string;
  width?: number;
  ellipsis: boolean;
  format?: string;
  dataSource?: Array<{ label: string; value: unknown }>;
  inline?: string[];
  expandable?: boolean;
  visible?: boolean;
  defaultVisible: boolean;
  order: number;
}
```

### `projectFilterFields(schema, catalog?)`

把模型 Schema 投影为筛选字段列表。嵌套叶子字段会以 `$root.<path>` 作为 key，并保留真实 `path`。

```ts
import { projectFilterFields } from "@alien-form/cms";

const filters = projectFilterFields(productSchema, adapterCatalog);
```

### `resolveSceneRender(field, scene, catalog)`

解析字段在指定场景下应该使用哪个组件、模式、props 和 operator。

```ts
import { resolveSceneRender } from "@alien-form/cms";

const render = resolveSceneRender(
  productSchema.properties!.status,
  "recordFilter",
  adapterCatalog,
);

if (render) {
  console.log(render.componentKey, render.mode, render.operator);
}
```

### `buildSceneComponents(scene, catalog, componentMap, wrap?)`

根据 Adapter Catalog 为指定场景生成组件表。

```ts
import { buildSceneComponents } from "@alien-form/cms";

const filterComponents = buildSceneComponents(
  "recordFilter",
  adapterCatalog,
  componentMap,
  (Component, mode, props) => {
    return function WrappedComponent(userProps) {
      return <Component {...props} {...userProps} mode={mode} />;
    };
  },
);
```

## Adapter 定义

Adapter 用于声明组件在不同 CMS 场景下的能力。

```ts
import {
  createAdapterCatalog,
  createAdapterRegistry,
  defineAdapter,
} from "@alien-form/cms";

const Select = defineAdapter(SelectComponent, {
  key: "Select",
  label: "下拉选择",
  description: "用于从选项中选择一个或多个值。",
  kind: "component",
  meta: {
    fieldType: "string",
  },
  params: [
    {
      name: "mode",
      type: "string",
      description: "渲染模式",
    },
  ],
  scenes: {
    recordForm: { mode: "edit" },
    recordFilter: { mode: "filter", operator: "in" },
    recordDetail: { renderAs: "DisplayChoice" },
    tableCell: { renderAs: "DisplayChoice", summary: true },
    builder: { mode: "readonly" },
  },
});

const adapters = createAdapterRegistry({
  Select,
});

const catalog = createAdapterCatalog(adapters);
```

### Adapter Scene

```ts
type AdapterScene =
  | "recordForm"
  | "recordDetail"
  | "recordFilter"
  | "tableCell"
  | "builder";
```

### Scene Mode

```ts
type SceneMode = "edit" | "readonly" | "cell" | "filter";
```

### Scene Variant

| 字段 | 说明 |
| --- | --- |
| `mode` | 该场景下的组件模式；缺省由场景推导。 |
| `renderAs` | 委托给另一个 adapter key 渲染。 |
| `props` | 该场景的默认 props，优先级低于字段 props 和 `x-cms` props。 |
| `operator` | 仅筛选场景使用的默认操作符。 |
| `summary` | 仅表格场景使用，表示是否压缩为摘要。 |

## Handler 定义

Handler 用于描述运行时函数的元信息，常用于 Builder 中生成 `x-reaction`。

```ts
import {
  createHandlerCatalog,
  createHandlerRegistry,
  defineHandler,
} from "@alien-form/cms";

const loadCityOptions = defineHandler(
  async (ctx) => {
    const country = ctx.get("country");
    return country === "cn"
      ? [{ label: "杭州", value: "hangzhou" }]
      : [{ label: "New York", value: "new-york" }];
  },
  {
    key: "loadCityOptions",
    label: "加载城市选项",
    description: "根据国家字段加载城市下拉选项。",
    supportedTargets: ["dataSource"],
    defaultConfig: {},
    params: [
      {
        name: "countryField",
        type: "string",
        default: "country",
      },
    ],
  },
);

const handlers = createHandlerRegistry({
  loadCityOptions,
});

const catalog = createHandlerCatalog(handlers);
```

## Builder 工具

### `buildModelSchema(draft)`

把可视化 Builder 草稿转换为 `CmsModelSchema`。

```ts
import { buildModelSchema } from "@alien-form/cms";

const schema = buildModelSchema({
  modelName: "product",
  title: "商品",
  subtitle: "",
  description: "",
  singularLabel: "商品",
  pluralLabel: "商品",
  defaultPageSize: 10,
  filterCount: 3,
  openMode: {
    add: "drawer",
    edit: "drawer",
    detail: "drawer",
  },
  tableVisibleFields: ["name", "status"],
  fields: [
    {
      id: "field-name",
      key: "name",
      title: "商品名称",
      type: "string",
      component: "Input",
      decorator: "FormItem",
      required: true,
      propsText: "{}",
      dataSourceText: "",
      defaultValueText: "",
      tableWidthText: "240",
      tableEllipsis: true,
      tableInlineFields: [],
      reactions: [],
    },
  ],
});
```

### `schemaToBuilderDraft(schema)`

把 `CmsModelSchema` 转回 Builder 草稿，用于编辑已有模型。

```ts
import { schemaToBuilderDraft } from "@alien-form/cms";

const draft = schemaToBuilderDraft(productSchema);
```

### 其他 Schema 工具

| API | 说明 |
| --- | --- |
| `normalizeSchema(schema)` | 标准化模型 Schema。 |
| `isSystemField(key)` | 判断是否是系统字段。 |
| `countAtomicFields(schema)` | 统计原子字段数量。 |

## 配置类型

### `AlienCmsConfig`

```ts
interface AlienCmsConfig {
  version: "1.0";
  name: string;
  description?: string;
  baseUrl?: string;
  auth?: {
    username?: string;
    password?: string;
  };
  adapter?: AdapterConfig;
  options?: {
    timeout?: number;
    retries?: number;
    headers?: Record<string, string>;
  };
}
```

### `AdapterConfig`

用于适配不同后端的请求和响应结构。

```ts
interface AdapterConfig {
  request?: {
    list?: {
      pagination?: {
        currentKey?: string;
        pageSizeKey?: string;
        strategy?: "pageNumber" | "offset";
      };
      sorter?: {
        fieldKey?: string;
        orderKey?: string;
        ascValue?: string;
        descValue?: string;
      };
      filters?: {
        strategy?: "flat" | "nested" | "body";
      };
    };
  };
  response?: {
    list?: {
      dataPath?: string;
      totalPath?: string;
    };
    detail?: {
      dataPath?: string;
    };
    create?: {
      dataPath?: string;
    };
    update?: {
      dataPath?: string;
    };
  };
}
```

## 常用类型

```ts
import type {
  CmsFieldSchema,
  CmsModelSchema,
  ModelRecord,
  PaginatedResult,
  Pagination,
  RecordListParams,
  SchemaListParams,
  Sorter,
} from "@alien-form/cms";
```

| 类型 | 说明 |
| --- | --- |
| `CmsModelSchema` | CMS 模型 Schema。 |
| `CmsFieldSchema` | CMS 字段 Schema。 |
| `ModelSummary` | 模型列表摘要。 |
| `ModelRecord` | 记录数据。 |
| `Pagination` | 分页参数。 |
| `PaginatedResult<T>` | 分页结果。 |
| `Sorter` | 排序参数。 |
| `FilterItem` | 类型化筛选条件。 |
| `MutationResult<T>` | 创建、更新、删除结果。 |

## 与其他包的关系

- `@alien-form/core` 提供基础 Schema 类型和表单运行时，`@alien-form/cms` 在其上扩展模型与场景元信息。
- `@alien-form/react` 可以消费 `@alien-form/cms` 投影结果，将模型 Schema 渲染为表单、筛选器或详情页。
- `apps/alien-cms` 是该包能力的完整应用示例。

## 开发

```bash
pnpm --filter @alien-form/cms run test
pnpm --filter @alien-form/cms run build
```
