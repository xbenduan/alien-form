# Alien Form / Formwork

Solid 无头表单内核、完整模型工作台、Vite 静态能力索引与六项 MCP 工具。

使用 Node **26.13.0** 和 pnpm **12.16.1**：

```sh
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

打开 `http://127.0.0.1:5173`。默认启动独立开发服务 `:8788`，使用独立文件数据。
默认端口被占用时，启动器会自动向后选择可用端口，并输出实际 URL。

```sh
# 端口被占用时
FORMWORK_CLIENT_PORT=5188 pnpm dev

# 构建、类型、行为测试、真实 Chromium 客户端验收
pnpm exec playwright install chromium
pnpm check
```

- [启动、模型、HTTP 与 MCP 使用说明](docs/formwork-development.md)
- [重构方案与实施状态](docs/formwork-refactor.md)
- [公开契约与运行机制](docs/formwork-design.md)

旧 `protocol`、`alienbase` 和 `alien-worker` 作为独立后端保留；生产平台与历史数据迁移属于后续范围。
