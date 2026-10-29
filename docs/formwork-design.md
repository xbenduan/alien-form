# Formwork 公开契约与运行机制

Formwork 以 `defineFormwork → definePage / defineWindow → 可选 defineDomain` 装配 Solid 应用。后端模型从 Worker API 加载，Page 定义可复用行为，Domain 定制当前实例，Render 和 ValueScope 保持无头。

## 四个包的边界

| 位置                   | 职责                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `packages/formwork`    | 纯模型/API/MCP 契约、Solid runtime/scope/Render/Host       |
| `packages/vite-plugin` | 可达代码分析、JSX 转换、声明/JSDoc、能力清单与开发登记     |
| `apps/client`          | 组件、Page/Window、cms Domain、Presenter、登录与模型工作台 |
| `apps/service`         | Hono Worker、D1、身份、版本/草稿、记录与迁移               |

`formwork/model` 与 `formwork/mcp` 的 Node 入口不加载 UI 或 DOM；`formwork` 是 Solid 入口。数据库定义只有 JSON 值，Domain 的 RuntimeView props 可含组件函数等代码值，不能回写为数据库 document。

## 完整定义与快照

```ts
type ModelDefinition = { document: ModelDocument; backend: BackendDefinition };
type ModelDocument = {
  id: string;
  title: string;
  data: ObjectSchema;
  views?: Record<string, ViewNode>;
};
```

data 使用 properties/required、数组 items 和本地 $defs/$ref。View 与数据分离，component 按有效组件表查找，field 是相对当前 object/item 根的 JSON Pointer。bindings/props 支持可信 `{{ }}` 表达式；Worker 仅解析表达式语法和引用，不执行前端函数。

backend 定义 storage bindings、relations、permissions 与可信 behavior 名称。binding.id 为稳定根字段身份，path 定位当前字段；column/jsonKey、sqlType、encoding 描述存储。权限和关系引用稳定身份，定义整体发布。

| 快照              | 用途                                                                |
| ----------------- | ------------------------------------------------------------------- |
| ManagedEntry      | 可管理目录、revision、stage、publishedVersion、canManage/canPublish |
| ManagedSnapshot   | 最新草稿优先、原始 definition、baseVersion、diagnostics             |
| PublishedSnapshot | 完整有效 definition、不可变 version/revision                        |
| RuntimeSnapshot   | 授权 schema、version/revision，无 backend                           |
| PreviewSnapshot   | 审阅 schema、managementRevision、stage、baseVersion                 |
| RuntimeSchema     | Domain 返回的 data/views，View props 保留代码值                     |

无效草稿可以保存。只有 JSON 可序列化、document 为对象且 id 匹配路由是保存前硬要求；发布才要求完整有效。management revision 是 opaque CAS，`ifRevision:null` 只创建不存在的模型；版本号不代替管理 revision。

## Page loader 与 Domain transform

schema Page/Window 必须显式声明 `getSchema`，不从其他源隐式回退：

```tsx
const list = definePage({
  router: "list",
  path: "/list/:domain",
  getSchema: async (ctx) =>
    (await ctx.api.runtime.schema(ctx.domain, { signal: ctx.signal })).schema,
  container: List,
  domains: { cms: () => import("./domains/cms") },
});
```

加载顺序固定：

1. 捕获 domain/params 与 Instance lifetime，加载可选延迟 Domain。
2. Page/Window loader 从 API 取得已发布 ModelDocument。
3. 纯 JSON 结构、id 与有效代码 Zod `schema` 校验。
4. 将独立后端文档放入 Domain `ctx.schema`，调用 Domain `getSchema`。
5. 检查 RuntimeSchema 和有效 View 后创建 scope/Render/container。

`schema` 配置表示 Zod validator，`getSchema` 的 Page 版本表示加载，Domain 版本表示加工。Domain 未提供 transform 时直接使用已加载 schema，不替换 loader。

```tsx
export default defineDomain({
  components: { RichText },
  getSchema: (ctx) => ({
    ...ctx.schema,
    views: {
      ...ctx.schema.views,
      add: {
        component: "Object",
        field: "",
        children: [
          { component: "Input", field: "/title" },
          { component: "RichText", field: "/content" },
        ],
      },
    },
  }),
});
```

Domain 可改变描述、component、props、View 和当前交互；不改变后端记录目标。所有记录 fn 按 `ctx.domain` 请求，Worker 始终鉴权并校验当前发布定义。RuntimeView 不再经过 JSON clone，因此代码 props 得以保留。

## 普通内容与 Window

`definePage({ router, render })` 为非 schema 内容，如登录和工作台；render 与 loader/schema/container 互斥。`defineWindow` 在相同内容机制上固定 `presentation:"page"|"modal"|"drawer"` 和 `returnTo`，Presenter 只承载完整内容和关闭动作。

Host 属于 Router 的常驻 root，Frame 捕获 params/path/history。`open` 返回 completed(value) 或 cancelled，成功列表调用者刷新同 id；嵌套 Window 的取消、Esc、History 返回、焦点恢复与直达 returnTo 都由 Host 管理。Presenter 构造时的重定向应延后到 frame 登记完成，避免被 Host 的 history replace 覆盖。

实例卸载、重试或 route 替换会先停止请求与写入，再清理独立 owner。异步加载和校验结果检查 lifetime/turn，过期结果不得更新现有实例。近层 components/fn/schema/container 覆盖按明确 key 合并，Domain 可以稀疏覆盖。

## ValueScope 与 Render

ValueScope 提供 value/set/reset/validate/array，持有独立值根，value 返回 JSON 快照。`createScope` 仅在当前 Instance owner 下创建；查询 scope 使用 defaults:false，业务编辑使用模型默认值。数组项 key 和 item scope 独立，move 保持身份，删除停止该项订阅。

Render 可使用默认树、显式 view 或单个 field；value/readOnly/disabled/visible bindings 与受控 onChange 一致。Object/Array 由 scope 边界承载，布局节点不创建虚假数据字段。字段容器接收 path/title/required/errors，组件接收 value/onChange/schema 等公开 props。

代码 scope validator 可以同步或异步返回 issues；stale 不更新错误。隐藏值由后端 update merge 保留，客户端装载记录只把 schema 声明字段放进表单，避免 API metadata 被根 additionalProperties 校验误判。

## API、能力清单和 MCP

`defineFormwork` 注入唯一 `FormworkApi`，所有 fn、loader、管理页通过 `ctx.api` 访问服务。Bearer token 来自会话函数，不嵌入构建产物。API 错误统一 code/message/issues/currentRevision。

插件只静态分析 entry 可达定义：routes、schemaRouters、默认与 Domain components/fn、源码位置、原声明/JSDoc、loader/transform/Zod 声明和 runtimeChecks。未知动态引用给出诊断，不通过执行 UI 模块推测能力。`virtual:formwork/capabilities` 提供代码能力，生产输出 `formwork-capabilities.json`。

MCP 六工具通过真实 Worker API 调用 models.list/read/validate/write/preview 与 formwork.capabilities。read/write 永远是共享管理状态，write 不发布。完整 definition 与错误校验由前后端共享输入契约，stdio 使用官方 SDK。

## 管理预览、发布与刷新

工作台编辑完整 definition，保存返回草稿诊断；只有无未保存文本、已保存 draft、user + canPublish 状态才能点击手动发布。发布失败保留文本和 draft，CAS 冲突显示当前 revision，必须显式重新载入并合并。

独立 model-preview 页调用 draft-schema 并检查审阅 revision，复用普通 Page 与 Domain；注入 API 的 create/update/delete/command 被阻断。未发布模型只有默认值预览，不创建业务表或记录。普通路径的 URL/query 不改变 schema 来源。

普通 Page/Window 新挂载或刷新取当前发布 schema，不监听模型更新。旧页保留 schema/值快照，提交不满足当前发布规则时 422 并保留输入；提交事务中并发发布则 409 SCHEMA_CHANGED。

后端事务、字段与权限迁移规则见 [Worker/D1 设计](./backend-system-design.md)，命令及部署顺序见 [开发说明](./formwork-development.md)。
