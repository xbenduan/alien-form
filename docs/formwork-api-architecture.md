# Formwork 运行时与数据 API

Formwork 的公开入口分为应用装配、可组合组件、数据客户端、模型协议与 MCP。UI 和样式由 app 提供，所有注册项都来自显式 JavaScript import。

| 包入口           | 主要导出                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formwork`       | `defineFormwork`、`defineDomain`、`definePage`、`Formwork` 及上下文类型                                                                             |
| `formwork/atom`  | `Records`、`Detail`、`Editor`、`RecordOutlet`、`Filters`、`RecordsTable`、`Pagination`、`RecordActions`、`Fields`、`Field`、两个 controller factory |
| `formwork/data`  | `FormworkApis`、`createDataClient`、`RecordSnapshot`、`QueryResult`                                                                                 |
| `formwork/model` | Schema、format 契约、校验、编译、`createFormworkApi`                                                                                                |
| `formwork/mcp`   | MCP 工具及协议描述                                                                                                                                  |

## 注册应用、Domain 和 Page

```tsx
import { defineDomain } from "formwork";
import { Records, Detail, Editor } from "formwork/atom";

export default defineDomain({
  router: "list",
  render: () => (
    <Records
      presentation="modal"
      detail={(operation) => <Detail operation={operation} />}
      create={(operation) => <Editor operation={operation} />}
      edit={(operation) => <Editor operation={operation} />}
    />
  ),
});
```

Domain 地址为 `/router/:modelId`，`render` 得到已加载的 `ModelContext`。普通 Page 使用 `definePage({router,render})`，地址固定为 `/router`，`PageContext.query()` 返回 URLSearchParams，额外参数放 query。Page 不自动加载模型；需要模型的 atom 显式传入 `modelId`。

应用使用 `defineFormwork({apis,components,ui,domains,pages})`。`domains` 和 `pages` 必须是数组，可以为空；router 必须是小写路径段，两类路由不能重名。`Formwork` 接收 `app`、可选 `class` 和用于嵌入预览的 `memoryHistory`。挂载会创建独立数据环境、路由和导航守卫。

`components` 是名称到 Solid 组件的映射。`ui` 选择字段、列表部件、详情/编辑布局、presenter 和反馈组件。按实际使用的能力提供映射；未知组件或缺失必需映射会给出错误。框架不附带视觉组件或 CSS。

## 加工 Schema

```ts
import type { SchemaTransform } from "formwork";

/** 为内容模型的标题选择专用表单组件。 */
export const transformSchema: SchemaTransform = (ctx) => {
  if (ctx.schema.domain === "cms" && ctx.schema.data.title) {
    const title = ctx.schema.data.title;
    if (title.ui.form !== false) title.ui.form.component = "RichTitle";
  }
  return ctx;
};
```

先把 `RichTitle` 注册到 app.components，再将函数传给 app 或特定 Domain。加工顺序为 app → 当前 router 的 Domain → atom 的局部 transform。每个 hook 修改 `ctx.schema` 并返回同一个 `ctx`；`ctx.sourceSchema` 是冻结的原始定义。框架在每轮前解析引用、规范化 format、初始化场景配置，`false` 表示显式隐藏。

同一模型及 router 的子 atom 复用当前上下文；局部 transform 在副本上加工。显式切换模型时重新加载，默认只应用 app 规则；需要目标 Domain 规则时同时指定 `router`。`schema.domain` 仅供业务代码分类，不负责匹配路由。

展示加工不会修改持久化 Schema，也不会提高服务端能力。合法值、格式、字段权限与记录权限仍由后端执行。

## 组合列表与记录操作

`createRecordList(() => options)` 在 Formwork 的 Solid owner 中创建一个列表实例。选项为 `modelId`、`router`、局部 `transformSchema`、`pageSize` 和 `scopeKey`。在 Domain 内省略模型参数即可继承上下文。

| controller 能力                                           | 用途                                         |
| --------------------------------------------------------- | -------------------------------------------- |
| `model()`、`items()`、`total()`、`query()`                | 当前模型、记录快照、数量和查询               |
| `filter(clauses)`、`sort(sort)`、`page(n)`、`pageSize(n)` | 更新查询，筛选和排序会回第一页               |
| `loading()`、`error()`、`refresh()`                       | 显示状态和重试                               |
| `allowed(action)`                                         | 综合后端权限、API 是否接入、slot 是否禁用    |
| `openDetail(id)`、`openEdit(id)`、`openCreate()`          | 打开记录操作，可传展示方式                   |
| `delete(snapshot)`                                        | 确认后带双版本条件删除，成功通知订阅列表刷新 |
| `operation()`                                             | 当前激活的详情、新建或编辑操作               |

`Records` 默认组合全部列表部件和 `RecordOutlet`，也可接收已有 controller。自定义布局将同一 controller 交给多个 atom，自己渲染卡片或树形行，最后挂载一个 `RecordOutlet`。部件不创建第二份查询。

`ui.records.table` 对应的组件需渲染 `children`，其中包含默认加载/空态与分页。应用将它们放在表格的同一面板内，使外框连续；单独使用 `RecordsTable` 时也可传入自己的页脚。

每个 controller 只允许一个 outlet；同一模型及 Domain 的多个集合须使用不同 `scopeKey`，非默认集合写入 URL 的 `?scope=…`。outlet 应随布局稳定挂载，避免被列表加载或空态条件卸载。controller 由创建它的 Solid owner 清理，借用者只消费状态。

`detail/create/edit` 是延迟 slot，激活操作时才传入 `RecordOperation` 并创建内容。省略时使用默认 Detail/Editor，传 `false` 同时禁用相应动作与直达入口。自定义 slot 应使用 `operation.guard()` 注册未保存检查，完成后调用 `operation.complete(snapshot)`，取消调用 `operation.close()`。

| 操作地址                   | 行为                             |
| -------------------------- | -------------------------------- |
| `/list/articles/create`    | 新建独立草稿，只在创建时补默认值 |
| `/list/articles/edit/a1`   | 读取记录后编辑，保存失败保留输入 |
| `/list/articles/detail/a1` | 读取完整记录，按只读场景渲染     |

从列表打开时采用指定的 page/modal/drawer。直接访问或刷新地址统一使用 page。操作切换清理旧 scope、取消请求并注销守卫；保存成功关闭操作，数据客户端通知关联查询刷新。当前提供单个活动操作，不提供任意嵌套操作栈。

## 独立 Detail、Editor 与字段

普通 Page 内可以写 `<Detail modelId="articles" recordId="a1" />`，或者 `<Editor modelId="articles" recordId="a1" mode="edit" />`。独立 Editor 保存后更新记录版本及 dirty 基线，允许继续编辑。`createRecordEditor` 让 app 自己组织布局和提交按钮。

`ModelContext` 提供 `model`、`RenderItem`、`createScope` 和 `data`。字段描述不持有当前记录值；编辑值存在 ValueScope，查询条件使用独立 FilterBinding。

```tsx
const RenderItem = ctx.RenderItem;
const title = ctx.model.field("/title");
const scope = ctx.createScope();

<RenderItem field={title} scene="form" binding={scope.field("/title")} />;
<RenderItem field={title} scene="table" value={record.data.title} record={record.data} />;
```

`Fields` 遍历模型字段；`Field` 渲染指定字段。字段组件接收 `field/scene/value/onChange/readOnly/disabled/errors`；枚举及关系还接收 options、multiple 等。对象和数组通过 children、Item/ValueItem 递归，ArrayHandle 保留移动项的稳定 key。当前没有单独的 `ArrayItems`、`RelationPicker` 或管理页 atom。

`FieldContainerProps.binding` 允许应用提供“删除值”和“设置 null”。所有写入都通过受控 binding；`undefined` 表示缺失，不能替代 `null`。复杂值和权限语义见[字段协议](schema-design.md)。

## 接入数据 API

适配器实现 `FormworkApis`。第二个参数为 `{signal?,requestId}`；框架在调用前后检查取消信号，适配器应将 signal 继续传给 fetch。可选写方法缺失时不提供对应动作。

| 操作                      | 输入                                                           | 输出                                   |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `models.get`              | `{modelId}`                                                    | `{schema,schemaRevision,capabilities}` |
| `models.list`（可选）     | `{}`                                                           | `[{id,title}]`                         |
| `records.query`           | `{modelId,query}`                                              | `{items:RecordSnapshot[],total}`       |
| `records.get`             | `{modelId,recordId}`                                           | `RecordSnapshot`                       |
| `records.create`          | `{modelId,data,ifSchemaRevision}`                              | `RecordSnapshot`                       |
| `records.update`          | `{modelId,recordId,changes,ifSchemaRevision,ifRecordRevision}` | `RecordSnapshot`                       |
| `records.delete`          | `{modelId,recordId,ifSchemaRevision,ifRecordRevision}`         | `{id,deleted:true}`                    |
| `records.options`（可选） | `{modelId,fieldId,keyword?,selectedValues?,limit?}`            | `{options,total}`                      |

`RecordSnapshot` 必须包含 `{id,data,revision,schemaRevision}`。版本不放入可编辑字段；服务端身份字段可出现在授权后的 data 中。`capabilities.actions` 明确 read/create/update/delete，`capabilities.fields` 按 JSON Pointer 提供 read、可选 create/update、filter 运算符和 sort 能力。没有额外 `features` 或默认权限继承协议。

`changes` 为 `{set?:Record<string,JsonValue>,unset?:string[]}`：set 的键是根字段名，unset 使用根字段 Pointer。更新按根字段合并，受限的嵌套对象和数组仍必须通过服务端校验。模型或记录的并发冲突分别返回 `SCHEMA_CONFLICT`、`RECORD_CONFLICT`，不能静默重读版本并覆盖。

无 UI 使用：

```ts
import { createDataClient } from "formwork/data";
import { apis } from "./api";

const data = createDataClient({ apis });
const page = await data.query({
  modelId: "articles",
  query: { clauses: [], page: 1, pageSize: 10 },
});
```

## Worker HTTP 对应关系

以下路径相对 `/api/v1`；请求携带 Bearer token。`createFormworkApi` 负责路径、错误及认证处理，`apps/client/src/formwork/api.ts` 将它接到 FormworkApis。

| HTTP                                  | 请求体或参数                                  |
| ------------------------------------- | --------------------------------------------- |
| `GET /runtime/models/:modelId/schema` | 已发布且按权限投影的模型                      |
| `POST /records/:modelId/query`        | RecordQuery                                   |
| `GET /records/:modelId/:recordId`     | 返回记录快照                                  |
| `POST /records/:modelId`              | `{data,ifSchemaRevision}`                     |
| `PATCH /records/:modelId/:recordId`   | `{changes,ifSchemaRevision,ifRecordRevision}` |
| `DELETE /records/:modelId/:recordId`  | `{ifSchemaRevision,ifRecordRevision}`         |
| `POST /records/:modelId/options`      | `{fieldId,keyword?,selectedValues?,limit?}`   |
| `PUT /models/:modelId/draft`          | `{definition,ifRevision}`                     |
| `POST /models/:modelId/validate`      | `{definition,router?}`                        |
| `POST /models/:modelId/publish`       | `{ifRevision}`                                |

模型管理使用 management revision；记录写入使用 schema revision 和 record revision。三种版本各有用途。模型发布与记录写入在数据库事务中检查条件，前端校验不能替代它。

## 可选能力清单

`formwork-vite-plugin` 只静态分析显式入口、生成能力清单及开发期登记，不改写 JSX，也不发现隐藏目录。CMS 通过 `capabilities:register` 直接分析入口，运行不依赖插件。

清单为 `{formatVersion:1,appId,revision,clientOrigin,app,domains,pages}`。app 保存共享组件、格式、UI 和 transform 声明；domains 按 router 保存 transform；pages 是普通路由数组。MCP 以 `{modelId,router}` 查询能力，普通 Page 不能作为模型 Domain 预览目标。静态分析不能证明 transform 的运行结果，未确定项保留为 runtimeChecks。

## 实现位置

| 目录                                         | 职责                                           |
| -------------------------------------------- | ---------------------------------------------- |
| `packages/formwork/src/core`                 | 应用装配、模型加工、路由、记录控制器和生命周期 |
| `packages/formwork/src/atom`                 | 可组合的列表、详情、编辑和字段能力             |
| `packages/formwork/src/data`                 | 无 DOM 的适配器协议、响应校验和变更订阅        |
| `packages/formwork/src/model`                | 字段协议、格式、值校验、后端编译和 HTTP client |
| `packages/formwork/src/runtime` / `render`   | scope、query binding 和受控字段渲染            |
| `apps/client/src/components` / `formwork`    | 应用 UI、映射、shell、presenter 和 HTTP 接入   |
| `apps/client/src/domains/{list,tree,videos}` | 模型布局；index 仅汇总数组                     |
| `apps/client/src/pages`                      | 模型管理、预览、登录、token 等普通页面         |
| `apps/service/src/application`               | 权限、发布兼容性、记录双版本写入和事务协调     |
