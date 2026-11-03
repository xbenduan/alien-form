# 字段协议的设计依据

当前作者协议为 `{schemaVersion:1,id,title,domain?,data,$defs?,tree?,backend?}`。准确字段规范见[字段协议](docs/schema-design.md)，应用接入见[运行时 API](docs/formwork-api-architecture.md)，最终架构及取舍见[重构设计](docs/formwork-redesign-exploration.md)。

## 一份字段事实供多个消费者使用

字段的 type、format、enum、relation、required、default 与 readOnly 放在同一份定义中。前端消费它生成字段描述，服务端消费它校验值、编译存储、限制查询和检查权限。服务端派生的 CompiledDefinition 不要求作者再维护一次。

| 选择                         | 原因                                              |
| ---------------------------- | ------------------------------------------------- |
| type 保留真实 JSON 值形态    | 字符串、数组、对象和 null 能在前后端往返          |
| format 表达共享字段契约      | 组件名称不决定数据库类型或值校验                  |
| 字段级 props，场景级 ui      | 共用展示提示，必要时覆盖组件或隐藏场景            |
| stable field id 与字段名分离 | 根字段改名可保留物理身份                          |
| 查询状态与记录 scope 分离    | filter 不继承记录的 required、default 或 readOnly |
| Schema 不保存布局与表达式    | Domain、Page 和普通 JSX 承担交互与展示代码        |

## headless 装配边界

app 显式注册 `apis/components/ui/domains/pages`。Domain 通过 router 和 render 选择模型布局；Page 处理固定地址的普通页面。`formwork/atom` 提供 Records、Detail、Editor 和共享 controller，应用无需为每个模型重写记录 CRUD。

展示加工按 app → Domain → 局部 transform 执行，修改 Schema 副本并返回 ctx。字段 format 的实际值约束由客户端与服务端共享；覆盖 UI 不改变后端授权。

## 当前项目的范围

此次重构按未部署项目重新实现，删除历史协议转换、数据库升级计划及对应脚本。新数据从当前协议初始化。未来发布仍拒绝不兼容的结构或存储变更，避免破坏已经录入的记录。

默认 list 是正式接入场景。tree-list 仅演示当前查询页的父节点分组，videos 仅演示卡片和详情。richtext 使用普通字符串与 textarea，没有内容编码转换或专业编辑器依赖。
