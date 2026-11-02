import { controlledProps } from "../model/schema";
import type { ModelDefinition } from "../model/types";

/** 在 initialize 中说明无需项目上下文即可发现组件并构建模型的入口。 */
export const mcpInstructions = `此 MCP 管理 ALIEN CMS 的 Formwork 模型。
首次连接或没有项目上下文时，先调用 formwork.describe({})，取得模型构建指南、完整 definition JSON Schema、可用模板、当前权限和工作流。
调用 formwork.capabilities({}) 即可列出当前应用全部已登记的 Framework、Domain、Page、Window 组件与 fn，包括声明、JSDoc、源码位置和路由参数。无需编辑器 URL、浏览器标签页或已有模型。
从目录选择目标，再调用 formwork.capabilities({modelId,router,window?,domain?}) 获取该目标实际有效的组件；不要把不同页面的局部组件当作全局组件。
修改现有模型先 models.list({})、models.read({modelId})；创建模型使用 describe 返回的完整 {document,backend} 模板。
依次 models.validate、修正 errors、models.write、models.preview。新建 ifRevision:null；修改 ifRevision 使用最近一次 read/write 返回的 revision。冲突后重新读取并合并。
models.write 只保存共享草稿；发布在管理页由用户完成。静态校验通过后，runtimeChecks 中的行为仍需浏览器预览验证。
也可读取 formwork://guide、formwork://capabilities、formwork://definition-schema 三个 MCP resources。`;

/** 提供可直接交给无项目上下文 agent 的模型构建规则。 */
export const modelAuthoringGuide = {
  purpose: "用 MCP 发现应用代码能力，构建、校验、保存和预览数据库模型。",
  discovery: [
    "formwork.describe({}) 无需任何已知 modelId、页面 URL 或浏览器；返回本指南、JSON Schema、完整模板、当前权限和调用示例。",
    "formwork.capabilities({}) 返回 DB 当前已激活的应用清单；framework/domains/pages/windows 保留作用域和声明。",
    "目录 targets 给出 router、window、viewKey、path、requiredParams 和 requiredPreviewParams；model:false 的页面不加载模型 schema。",
    "选定目标后用 {modelId,router,window?,domain?} 查询有效 components/fn，再按 declaration 和 jsDoc 配置组件。",
  ],
  definition: {
    shape:
      "{ document: { id, domain?, title, data, fields?, tree?, views?, pages? }, backend: { storage, relations, permissions, behavior } }",
    identity:
      "id 必须匹配 modelId，使用单段小写标识 /^[a-z][a-z0-9_-]*$/；system-* 是代码维护的只读系统模型。",
    data: "根 data 必须是 object，properties 描述字段；支持 string/number/integer/boolean/null/object/array，以及 [scalar,'null']。仅支持本 JSON Schema 中列出的关键字，不支持任意 JSON Schema。",
    references: "$defs 只能声明在根 data；$ref 只能为 #/$defs/name，不支持悬空或循环引用。",
    metadata:
      "title、description、default、readOnly 是数据 schema 元信息。required 只能引用当前 object 的已声明属性；additionalProperties 只能为 false。",
    fields:
      "fields 是 Pointer 到展示配置的对象，不是 fields[]。例如 {'/title':{order:0,form:{component:'Input'},table:{title:'标题'}}}。数组项配置使用 /addresses/*/city。form/table/filter 省略时使用默认展示，table/filter 可设为 false。",
    filter:
      "列表默认为非 readOnly 的根标量字段生成筛选项（string/number/integer/boolean/null，含可空标量和 enum）；object/array 不生成筛选项。fields[pointer].filter:false 会明确隐藏该字段的筛选项，全部设为 false 会使筛选区没有输入控件。需要筛选的标题、状态、数量等字段应省略 filter 或配置 filter:{}；不要因定制 form/table 就批量禁用 filter。",
    readOnly:
      "data.properties 中根字段的 readOnly:true 表示数据不可由客户端写入；新建与编辑提交会排除该字段，新建时由服务端补入 default，编辑时保留已有值。仅限制 UI 交互、但仍需保存的计算结果，应使用 fields[pointer].form.bindings.readOnly；disabled 也只限制控件交互，不等同于数据 readOnly。",
    views:
      "views 的键为目录中的 viewKey（router 或 router/window）；ViewNode 使用 component、field、props、bindings、children。component 省略时按 field 类型及字段展示配置推导。",
    scope:
      "field 是相对当前节点字段基址的 JSON Pointer；Object 子节点继承对象路径基址，Array 子节点使用数组项 scope。子节点写 /city 而非 /addresses/0/city。Page/Window 的 getSchema、getValue 可能改变根 schema/value，先查看目标能力声明。",
    domain:
      "显式 document.domain 选择已登记 Domain；省略时若 modelId 同名 Domain 已登记则使用它，否则使用 Framework。Domain 名和数据库 modelId 不必相同。",
    pages:
      "pages[router].windows[name].openMode 选择 page/drawer/modal，仅可引用已登记的 Page、Window 和 Presenter；定义不能创建新的代码组件或路由。",
    tree: "tree.parentField 和 labelField 是两个不同的根 string 或可空 string 字段 Pointer；parentField 必须有指向当前模型 id 的 many-to-one 关系。",
  },
  expressions: {
    syntax:
      "表达式是完整字符串 {{ ... }}；可用 $ctx、$schema、$values、$value、$field、fn。fn 只使用当前目标有效能力中的名字。",
    context: {
      $ctx: "当前 Context，含 API、params、signal 和代码能力，具体成员按有效能力声明使用。",
      $schema: "当前 Context.schema。",
      $values: "当前 ValueScope 的值；Array Item 中是当前数组项，Object 子节点仍在原 ValueScope。",
      $value: "当前绑定字段的值。",
      $field: "当前字段的相对 path 和 schema；未绑定 field 时为空。",
      fn: "当前目标有效的具名函数注册表。",
    },
    props:
      "普通 props 是 JSON 值；{{ ... }} 在浏览器求值。组件事件可通过表达式返回函数，按声明和 JSDoc 确认参数。",
    controlledProps: [...controlledProps],
    bindings:
      "value writer 把表达式结果自动写入 field，例如 {{ $values.quantity * 10 }}，只能用于 form；readOnly/disabled/visible 可以为 boolean 或表达式。不要在 props 中传受控属性。",
    runtime:
      "models.validate 解析表达式语法并检查已知 fn/组件，不执行浏览器代码；按 runtimeChecks 验证实际交互。",
  },
  backend: {
    storage:
      "每个根字段都要有一个稳定 binding：{id,path,column?,jsonKey?,sqlType,encoding,index?}。column 与 jsonKey 必须且只能选一个；path 是根字段 Pointer。重命名字段仍保留 binding.id。table/column/through 用 SQL 标识；table 禁止 fw_、sqlite_ 前缀及 models、sessions 保留名，不可占用他人表。",
    types: [
      { dataType: "string/null", sqlType: "TEXT", encoding: "scalar" },
      { dataType: "integer/boolean", sqlType: "INTEGER", encoding: "scalar" },
      { dataType: "number", sqlType: "REAL", encoding: "scalar" },
      { dataType: "object/array", sqlType: "TEXT", encoding: "json" },
    ],
    recordIdentity:
      "记录 id、createdAt、updatedAt、creatorId 由服务端维护，无需在最小模板声明；如声明必须 readOnly 且有稳定 binding，不能设为 privateFields。",
    relations:
      "fieldId/targetFieldId 引用稳定 binding.id，不是字段 Pointer。many-to-one 源字段为 string，many-to-many 为 string 数组；目标模型须已发布（自引用除外），目标为 id 或具有 unique index 的公开 string 字段。",
    permissions:
      "grants 配置已存在的 roleId、actions、scope(all/own)、可选 fields(稳定字段 id)；privateFields 也引用稳定 id。模板 grants:[] 不向其他业务角色授权，创建者/管理员可管理。用 models.read({modelId:'system-roles'}) 查询角色模型；若需要角色记录，应使用管理页或授权的业务 API。",
    behavior:
      "rules/commands/events 只能引用 Worker 已注册的可信处理器；可用名字在 describe.backendCapabilities。不能上传后端 JavaScript 源码。system.* 规则只供系统模型使用。",
  },
  workflow: [
    "创建：describe → capabilities({}) → 选择已登记目标/Domain → 定向 capabilities → 修改完整模板。",
    "修改：list → read → 保留现有 backend 与稳定字段 id → 按当前 domain 和目标查询有效能力。",
    "validate 返回 errors 与 runtimeChecks；修正所有 errors 后保存。write 允许保存未完成草稿，但错误草稿无法发布/预览。",
    "新建 write 必须 ifRevision:null；修改使用最新 read/write.revision。REVISION_CONFLICT 时重新 read 并合并，不能盲目覆盖。",
    "preview 使用目录中的 router/window；requiredPreviewParams 非空时必须传真实记录参数。无记录时优先选择不需要记录参数的列表或新增目标。",
    "preview 返回 URL 及 revision，浏览器需有可管理该模型的用户登录态；链接由 MCP 生成，无需向用户索取编辑器 URL。",
    "发布由用户在模型管理页完成；系统模型定义不可通过 MCP 修改。",
  ],
};

/** 创建可直接校验和保存的新模型模板。
 * @param modelId 同时写入 document.id 和独占表名；例如 orders 对应 model_orders。
 */
export function createDefinitionTemplate(modelId: string): ModelDefinition {
  return {
    document: {
      id: modelId,
      title: "新模型",
      data: {
        type: "object",
        properties: { title: { type: "string", title: "标题", minLength: 1 } },
        required: ["title"],
        additionalProperties: false,
      },
    },
    backend: {
      storage: {
        table: `model_${modelId.replaceAll("_", "__").replaceAll("-", "_d")}`,
        bindings: [
          { id: "title", path: "/title", column: "title", sqlType: "TEXT", encoding: "scalar" },
        ],
      },
      relations: [],
      permissions: { grants: [], privateFields: [] },
      behavior: { rules: [], commands: {}, events: {} },
    },
  };
}
