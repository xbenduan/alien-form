# 历史 SQL，仅供迁移输入核对

此目录归档旧 Worker 的 0001–0013 SQL，不属于 Wrangler 的活动 migrations_dir。
新库只执行 `../migrations` 下的 fw_* migration。不要在新库中重放此目录。

`../src/migration/fixtures` 中的旧系统协议和 orders/cms 文档仅用于一次性转换与测试；
Worker、Vite、业务页面和 MCP 均不以它们作为运行时模型来源。
