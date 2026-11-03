import { controlledProps } from "../model/field";
import type { ModelDefinition } from "../model/types";

/** 说明无需项目上下文即可发现组件和构建模型的 MCP 入口。 */
export const mcpInstructions = `此 MCP 管理 ALIEN CMS 的 Formwork 模型。
首次连接先调用 formwork.describe({})，读取作者协议、模板、当前权限及工作流。
formwork.capabilities({}) 返回 Framework、Domain、Page、Window 的 components、formats、fn 和源码声明。
作者只定义 {schemaVersion:1,id,title,domain?,data,$defs?,tree?,backend?}，data 是字段 map。
修改先 models.read，依次 models.validate、models.write、models.preview。新建 ifRevision:null，更新使用最新 revision。
models.write 保存共享草稿，发布在管理页由用户完成。页面布局及 Window openMode 由代码定义。
可读取 formwork://guide、formwork://capabilities、formwork://definition-schema。`;

/** 提供无项目上下文 agent 可使用的统一字段协议规则。 */
export const modelAuthoringGuide = {
  purpose: "发现应用能力，定义一次字段，并在前后端与 form/filter/table/detail 共用。",
  discovery: [
    "先 formwork.describe({}) 和 formwork.capabilities({})；无需浏览器或已知模型。",
    "用 {modelId,router,window?,domain?} 查询目标的 components、formats、fn、declaration 和 jsDoc。",
    "targets 中的 requiredPreviewParams 必须提供真实记录参数。",
  ],
  definition: {
    shape: "{schemaVersion:1,id,title,domain?,data:fieldMap,$defs?,tree?,backend?}",
    identity: "id 匹配 modelId；system-* 由代码维护。首次保存自动补齐字段 id；改名保留 id。",
    data: "type 决定值形态；required:true 属于当前字段。对象用 properties，数组用 items。props 是字段级共享 JSON。",
    format:
      "显式 format 必须已注册并通过共享 Zod 契约；省略按 Domain/Framework 推导。select 必须且只能有 enum 或 relation。",
    enum: "候选为原始值或 {value,label}；值类型一致且不重复。标量 enum 含 null 才允许 null，不同时声明 nullable。",
    plural:
      "strings/numbers/booleans 必须 type:array，可省略对应 items，候选统一放字段 enum。多选保存真实原子数组，table 用 Tag 展示。",
    nullable:
      "非 enum 标量及数组/对象用 nullable:true；缺失、null、空字符串分别处理。required 不禁止空串，需 minLength:1。",
    relation:
      "字段 relation:{model,valueField?,labelField?}，默认 /id、/name。记录保存原始引用，值与标签分开解析。不能和 enum 同时存在。",
    ui: "ui[scene] 只允许 false 或 {component}，scene 为 form/filter/table/detail；场景不重复定义 props。",
    filter:
      "按运行时 capabilities 展示所有后端支持的字段；ui.filter:false 仅隐藏界面，query.filter:false 禁止服务端查询。",
    table:
      "所有可读根字段默认展示，包括 id、readOnly、对象数组。复杂值提供详情入口，plural formats 使用 Tag。",
    references: "$defs 在模型根；仅支持 #/$defs/name。引用处允许元信息与展示覆盖，循环引用非法。",
    layout: "协议没有 views、pages、layout、decorator 或布局节点树；由 Page/Window 代码承载。",
    domain: "domain 显式选择领域；领域契约在前后端共享，组件实现只在前端。",
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
    migration:
      "存储身份与已有数据保留；类型、嵌套结构、关系目标变化需要显式迁移。旧布局协议必须先转换，不能静默丢弃。",
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
