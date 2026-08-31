# register/overrides —— 使用者定制入口

本目录及模型目录是 alien-mdm 作为**框架**对外提供的扩展点。使用者克隆本仓库后，**只在这里和 `register/{modelCode}/` 下工作**，永远不触碰 `register/global/` 和 `register/index.ts`。因此定制代码与框架代码物理隔离，`git pull` 升级框架时不会产生合并冲突，也不会版本脱节。

## 注册三层与优先级（由低到高）

```
register/
├── index.ts          # 注册总入口（框架维护，勿改）
├── global/           # ① 框架基线（框架维护，勿改）—— 优先级最低
├── overrides/        # ② 使用者全局覆盖（无 domain）—— 优先级次之
│   └── index.ts
└── {modelCode}/      # ③ 使用者模型定制（domain = 目录名）—— 优先级最高
    └── index.ts      #    仅限一级、文件名固定 index.ts，不支持嵌套
```

- **global**：框架开发者维护的默认组件 / 服务 / 常量，对所有模型生效，使用者不改。
- **overrides**：同 `code` 按 last-write-wins 覆盖 global（无 domain，对所有模型生效）。
- **{modelCode}**：带 `domain` 注册，只对该模型生效；渲染时优先取 domain 覆盖、回退 global。

## ② 全局覆盖：register/overrides/index.ts

在 `registerOverrides(runtime)` 里覆盖或新增全局能力，同 `code` 即替换 global 基线：

```ts
import type { Runtime } from "@alien-form/engine";
import { MyInput } from "./my-input";

export function registerOverrides(runtime: Runtime): void {
  // 覆盖框架的 Input 组件
  runtime.formComponent({ code: "Input", /* ... */ component: MyInput });
  // 覆盖或新增常量 / 服务同理：
  runtime.constant("status", [{ label: "在职", value: "on" }]);
}
```

## ③ 模型定制：register/{modelCode}/index.ts

新建 `register/{modelCode}/index.ts`，`default` 导出 `(runtime, domain) => void`。`domain` 即目录名（= 页面 domain），由框架自动发现并传入。带 `domain` 注册的能力只对该模型生效：

```ts
import type { Runtime } from "@alien-form/engine";
import { SchoolUserSelect } from "./school-user-select";

export default function register(runtime: Runtime, domain: string): void {
  // 仅在 school-user 模型下覆盖 Select
  runtime.formComponent({ code: "Select", /* ... */ component: SchoolUserSelect }, domain);
  runtime.constant("gender", [/* 该模型专属枚举 */], domain);
}
```

> 约束：模型目录仅识别**一级** `register/{modelCode}/index.ts`，不支持嵌套；`global`、`overrides` 为保留目录名，不会被当作模型 domain。
