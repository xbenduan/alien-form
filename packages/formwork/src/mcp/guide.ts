import { controlledProps } from "../model/field";
import type { ModelDefinition } from "../model/types";

/** 说明无需项目上下文即可发现组件和构建模型的 MCP 入口。 */
export const mcpInstructions = `此 MCP 管理 ALIEN CMS 的 Formwork 模型。
首次连接先调用 formwork.describe({})，读取作者协议、模板、当前权限及工作流。
formwork.capabilities({}) 返回 app 共享 components、formats、UI 源码声明与 Domain/Page 路由；此工具需要可选静态清单。
作者只定义 {schemaVersion:1,id,title,domain?,data,$defs?,tree?,backend?}，data 是字段 map。
修改先 models.read，依次 models.validate、models.write、models.preview。新建 ifRevision:null，更新使用最新 revision。
models.write 保存共享草稿，发布在管理页由用户完成。Domain 由 router 选择，schema.domain 仅为业务分类。
未登记静态清单不阻止校验、保存和发布；组件及 UI 映射需要在应用中实际验证。
可读取 formwork://guide、formwork://capabilities、formwork://definition-schema。`;

/** 提供无项目上下文 agent 可使用的统一字段协议规则。 */
export const modelAuthoringGuide = {
  purpose: "发现应用能力，定义一次字段，并在前后端与 form/filter/table/detail 共用。",
  discovery: [
    "先 formwork.describe({}) 和 formwork.capabilities({})；无需浏览器或已知模型。",
    "用 {modelId,router} 查询共享 components、formats、UI 声明及当前 Domain 加工。",
    "Domain 路径为 /router/:modelId，普通 Page 为 /router，额外参数放在 query。",
  ],
  definition: {
    shape: "{schemaVersion:1,id,title,domain?,data:fieldMap,$defs?,tree?,backend?}",
    identity: "id 匹配 modelId；system-* 由代码维护。首次保存自动补齐字段 id；改名保留 id。",
    data: "type 决定值形态；required:true 属于当前字段。对象用 properties，数组用 items。props 是字段级共享 JSON。",
    format:
      "显式 format 必须已注册并通过 app 与 Worker 共享 Zod 契约；省略按共享字段规则推导。select 必须且只能有 enum 或 relation。",
    enum: "候选为原始值或 {value,label}；值类型一致且不重复。标量 enum 含 null 才允许 null，不同时声明 nullable。",
    plural:
      "strings/numbers/booleans 必须 type:array，可省略对应 items，候选统一放字段 enum。多选保存真实原子数组，展示由 app.ui 决定。",
    nullable:
      "非 enum 标量及数组/对象用 nullable:true；缺失、null、空字符串分别处理。required 不禁止空串，需 minLength:1。",
    relation:
      "字段 relation:{model,valueField?,labelField?}，默认 /id、/name。记录保存原始引用，值与标签分开解析。不能和 enum 同时存在。",
    ui: "ui[scene] 为 false 或 {component?,props?}，scene 为 form/filter/table/detail；场景 props 覆盖字段 props。",
    filter:
      "按运行时 capabilities 展示所有后端支持的字段；ui.filter:false 仅隐藏界面，query.filter:false 禁止服务端查询。",
    table: "Records 默认展示可读根字段，包括 id、readOnly、对象数组；具体视觉由 app.ui 提供。",
    references: "$defs 在模型根；仅支持 #/$defs/name。引用处允许元信息与展示覆盖，循环引用非法。",
    layout:
      "协议没有 views、pages、layout、decorator 或布局节点树；Domain render 自行组合 Records、Detail、Editor 等 atom。",
    domain:
      "domain 仅为业务分类，不选择布局、字段契约、组件或权限。URL router 选择代码中显式注册的 Domain。",
    tree: "parentField 和 labelField 描述数据层级，使用根 string 字段 Pointer；父级必须引用当前模型。",
  },
  rendering: {
    controlledProps: [...controlledProps],
    scene: "组件收到受控 scene，readOnly 单独表示编辑权限。",
    value:
      "RenderItem 接受无状态 field 与 ValueBinding、FilterBinding 或当前行值；不会随渲染注册写入计算。",
    props:
      "持久化 props 必须为 JSON；函数和响应式值在代码调用处传入。props 不得伪造 value、options、relation、multiple、scene。",
  },
  backend: {
    storage:
      "不手写 bindings、sqlType、encoding。字段 storage 只声明 column/jsonKey/index/through 等例外，编译器生成存储计划。",
    identity: "id、createdAt、updatedAt、creatorId 由服务端维护，运行时会补齐只读描述。",
    permissions:
      "可选 backend.permissions 配置 grants 与 privateFields，引用稳定字段 id。默认不向业务角色授权。",
    behavior: "可选 backend.behavior 只能引用已注册 rules/commands/events，不能上传源码。",
    compatibility:
      "发布会保护已有记录、稳定字段身份和关系引用；不兼容的类型、嵌套结构或关系变更会被拒绝。本项目不提供历史协议迁移。",
  },
  workflow: [
    "describe → capabilities → 编写同一作者 Schema → validate → write → preview。",
    "修改先 read 并保留字段 id；write 使用最新 revision，冲突后重新读取并合并。",
    "草稿允许诊断；发布需所有 errors 清零，runtimeChecks 通过浏览器验证。",
    "MCP 只保存草稿，发布由用户在管理页完成。",
  ],
};

/** 创建无需手工存储绑定的新模型作者模板。 */
export function createDefinitionTemplate(modelId: string): ModelDefinition {
  return {
    schemaVersion: 1,
    id: modelId,
    title: "新模型",
    data: { title: { type: "string", title: "标题", required: true, minLength: 1 } },
  };
}
