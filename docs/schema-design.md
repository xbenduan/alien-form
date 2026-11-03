# 字段协议

作者只维护 `{schemaVersion:1,id,title,domain?,data,$defs?,tree?,backend?}`。`data` 是按字段名排列的 map，每个字段定义值契约、共享展示提示和少量例外。服务端的 `CompiledDefinition` 保存作者 `schema`，以及派生的 `document.data` 值 Schema 和 backend 计划，派生产物不作为第二份作者配置。

## type 与 format

`type` 表示真实 JSON 值，支持 string、number、integer、boolean、object、array、null。`format` 表示经过共享 Zod 校验的字段预设。

解析顺序是显式 format → Domain 的 `inferFormat` → Framework 推导；组件选择是本次 RenderItem 的 component → `ui[scene].component` → format 默认组件。

| 字段形态                        | 默认 format                  | 组件         |
| ------------------------------- | ---------------------------- | ------------ |
| string                          | input                        | Input        |
| number / integer                | number                       | NumberInput  |
| boolean                         | boolean                      | Boolean      |
| 原子 enum / relation            | select                       | Select       |
| string[] / number[] / boolean[] | strings / numbers / booleans | Select       |
| object                          | object                       | ObjectFields |
| 结构化 array                    | array                        | ArrayFields  |
| null                            | null                         | Null         |

`format:"select"` 必须且只能包含 enum 或 relation。plural formats 必须使用 `type:"array"`，可以省略 items；numbers 也允许显式 integer items。有候选时限制候选范围，无候选的 strings / numbers 支持输入添加，booleans 提供 true / false。原子多选要求值唯一，始终保留原始类型和选择顺序。

显式 `format:"array"` 可以把原子数组作为逐项编辑的数据。当前 `cms` 的 `richtext` 保存普通字符串，form 使用多行输入、filter 使用字符串查询、table 截断展示、detail 保留换行。它不把字符串解释为 HTML。

## props、scene 与覆盖

```json
{
  "type": "string",
  "props": { "placeholder": "输入标题", "maxWidth": 280 },
  "ui": { "filter": { "component": "Input" }, "detail": false }
}
```

`props` 仅在字段一级定义，持久化为 JSON。`ui.form/filter/table/detail` 仅支持 `false` 或 `{component}`，不能重复声明 props 或装饰器。动态函数、访问器和业务联动在应用代码中传给 RenderItem 或 scope，不执行持久化的 `{{ ... }}` 表达式。

组件收到明确的 scene。scene 不代表权限，readOnly 与 disabled 单独计算；例如 readOnly 记录字段仍可作为可编辑的筛选条件。value、onChange、scene、field、readOnly、errors、options、multiple 等受控属性不能在字段 props 中覆盖。

## 值语义

| 配置或值               | 含义                                                      |
| ---------------------- | --------------------------------------------------------- |
| `required:true`        | 对象中必须存在该字段；空串是否有效由 minLength 等约束决定 |
| 字段缺失 / `undefined` | 可选值不存在；HTTP PATCH 使用 unset 显式删除              |
| `nullable:true`        | 非 enum 字段允许 null                                     |
| 标量 enum 中的 null    | 允许空值；此时不再声明 nullable                           |
| `default`              | 仅创建新记录时补入缺失值，不覆盖 false、0、空串、null     |
| `readOnly:true`        | 记录字段不可编辑，嵌套只读约束同样生效                    |

数组的 enum 写在数组字段上，成员不能是 null。带 label 的候选使用 `{value,label}`；例如 `{value:false,label:"否"}` 保持 boolean，不能保存展示文本。

## 关系与复用

```json
{
  "type": "string",
  "relation": { "model": "departments", "valueField": "/id", "labelField": "/name" }
}
```

valueField 默认 `/id`，labelField 默认 `/name`，使用 JSON Pointer。数据保存引用原值，展示文本来自授权的关系选项接口。非 id 目标字段必须有 unique index；源与目标类型相同，目标和展示字段必须可读。数组关系的服务端数据与 through 表同步，控件搜索支持取消过期请求、批量回显和失败重试。

object 必须声明 properties，字段 required 在各自字段上声明。数组通过 items 递归；开放字典须提供明确 additionalProperties Schema。`$defs` 放在模型根，`$ref` 仅支持 `#/$defs/Name`，禁止循环引用。引用处可覆盖 id、title、description、required、readOnly、props、ui、storage、query；复用契约的 type、format、enum、items 等保持一致。`$defs` 不能携带物理字段 id，未使用的定义也会校验。

第一版 D1 adapter 仅支持根字段的 relation / storage；嵌套值存于 JSON，不支持嵌套物理绑定。

## 查询、表格与服务端策略

服务端根据字段类型、存储及当前授权产生 capabilities。客户端 FilterBar 展示所有有 filter 操作的字段，RecordTable 展示所有可读字段；身份字段和只读字段也参与。对象和结构化数组在 table 使用详情入口。

```json
{
  "clauses": [
    { "field": "/title", "operator": "contains", "operand": "方案" },
    { "field": "/status", "operator": "isNull" }
  ],
  "page": 1,
  "pageSize": 10
}
```

操作包括 eq、in、contains、between、isNull、isNotNull，以 capabilities 实际返回为准。between 使用两个数字，in 使用非空数组，空值操作不携带 operand。QueryState 与记录 scope 独立，不继承记录 required / default，也不会把隐藏或未启用条件提交。

字段 `query:{filter:false,sort:false}` 可以收窄能力；UI 隐藏只影响展示。`backend` 只定义存储表名例外、权限和可信行为。可选字段 storage 定义 column / jsonKey、index、through。作者不维护 sqlType、encoding 或重复的 relations 列表。

稳定字段 id 在首次保存时补齐。根字段改名保留 id 可复用物理位置；字段退役保留原存储。嵌套删除、改名、类型变化、收紧 required 或改变关系目标必须先处理迁移诊断。
