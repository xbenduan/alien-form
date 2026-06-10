# AlienForm

AlienForm 是一个以 Schema 驱动的表单工作区，采用 pnpm monorepo 组织。

## 工作区结构

- `packages/core`: 无头表单运行时内核
- `packages/react`: `core` 的 React 绑定层
- `packages/cms`: 面向 CMS 场景的 Schema 和 Provider 能力
- `apps/alien-cms`: 本地 CMS 应用
- `apps/server-cloudflare`: Cloudflare 后端服务

## 当前协议

AlienForm 已收敛到更小的运行时模型：

- `required` 保留为内置 UI + 必填校验简写
- `x-validate` 是自定义校验入口
- `x-format.input` 只在初始化时执行
- `x-format.output` 在输出投影和提交时执行
- `dataSourcePolicy` 决定选项变化后当前值如何处理

运行时值支持：

- 字面量值
- 表达式字符串：`"{{ a ? b : c }}"`
- handler 字符串：`"@handlerName"`
- 直接函数
- 运行时值数组

更详细的运行时说明见 [`packages/core/README.md`](./packages/core/README.md)。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm test:core
pnpm build
```
