# 运行时与代码归属

保留 Framework → Domain → Page → Window 的覆盖顺序。模型决定字段事实，共享契约决定默认行为，页面代码决定布局。Page / Window 仍通过 definePage / defineWindow 注册，Window 的 page、modal、drawer 由 presenter 承载。

## RenderItem 与 binding

PageContext 的 `model` 提供可复用的 FieldDescriptor，`RenderItem` 已绑定当前组件注册表。字段描述不持有当前记录值，table 不会为每行创建 scope。

```tsx
const RenderItem = ctx.RenderItem;
const title = ctx.model.field("/title");

// 记录编辑绑定当前 scope。
<RenderItem field={title} scene="form" binding={ctx.scope.field("/title")} />;

// 单元格只传原始值和记录，默认只读。
<RenderItem field={title} scene="table" value={record.title} record={record} />;

// 代码 props 适用于实例级动态展示；受控绑定仍由 renderer 提供。
<RenderItem
  field={title}
  scene="detail"
  value={record.title}
  component="Text"
  props={{ maxLines: 8 }}
/>;
```

`createQueryState(ctx.model)` 创建独立 FilterBinding，只有 filter scene 可以消费它。`ctx.scope.field(pointer)` 返回 ValueBinding，字段编辑通过 `binding.set()`；缺失值使用 undefined。复杂数组使用 ArrayHandle，移动数组项保留稳定 key 和子 scope。

组件统一接收 field、scene、value、onChange、readOnly、disabled、errors；Select 还收到 options、relation、multiple。真实 object / array 的子字段由 Children、Item / ValueItem 递归；这不构成布局 AST。`ctx.Render` 是简单逐字段遍历便利入口，复杂页面直接组合 RenderItem。

## Domain 共享契约

`packages/domain-contracts/index.ts` 是无 UI 的纯 TypeScript 模块，由 client 和 service 共同导入；共享格式包含 component 名称、字段 Zod schema，以及可选 normalize、valueSchema、props、inferFormat。

前端 `domains/cms/index.ts` 使用 `defineDomain({...cmsContract,components:{RichText},fn:{saveRecord}})` 注册实现。服务端按同一 domain 选择契约，不能通过组件名称猜数据库类型。`ui[scene].component` 和 Page / Window 组件覆盖不会绕过共享值校验。

## 实际目录

| 位置                                           | 职责                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/formwork/src/model/field.ts`         | 字段 Zod、format 注册、引用解析、FieldDescriptor                        |
| `model/schema.ts`、`types.ts`                  | 作者模型、快照、字段引用校验及公开类型                                  |
| `model/backend.ts`                             | 稳定字段身份、编译定义、运行时投影                                      |
| `model/query.ts`                               | 查询操作与 operand 契约                                                 |
| `runtime/scope.ts`、`query.ts`                 | 记录值与独立查询状态                                                    |
| `render/render.tsx`                            | RenderItem、受控 props、简单字段遍历                                    |
| `runtime/instance.tsx`、`router/`              | 四层装配、取消、scope 和导航生命周期                                    |
| `mcp/`、`packages/vite-plugin/src/`            | 协议导出及静态代码能力清单                                              |
| `apps/client/src/components/ui/`               | SelectControl、ChoiceControl、TagList、Modal、Drawer、JSON 编辑器和面板 |
| `components/fields/`                           | Input、Select、RichText、对象数组、场景外壳、复杂值详情和关系选项缓存   |
| `components/records/`                          | FilterBar、RecordTable、RecordForm，接收字段、状态及回调                |
| `formwork/data/`                               | 记录加载、Window 操作及关系 API 装配                                    |
| `formwork/defaults.ts`、`components/index.tsx` | 默认组件注册与应用装配                                                  |
| `pages/`、`domains/`                           | 页面布局、局部 Window 和业务选择                                        |
| `apps/service/src/application/`                | 发布、授权、值验证、迁移诊断及事务协调                                  |
| `adapters/d1/compiler/`、`repositories/`       | 参数化查询、保留历史的存储计划和数据访问                                |

依赖方向保持 `model ← runtime/render`、`model ← domain-contracts ← apps`。通用记录组件不接收整个 PageContext；持有导航和 API 的组合位于 formwork/data。list 与 tree-list 使用同一记录装配，不互相导入页面组件。

没有持久化布局解释器或动态表达式执行器。旧表达式需要迁入明确的 scope / 业务函数生命周期；旧页面配置迁入 Page / Window 代码。
