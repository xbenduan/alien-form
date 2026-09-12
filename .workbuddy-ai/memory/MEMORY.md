# alien-form — 项目长期备忘

## 项目形态
pnpm monorepo（`packages/*` + `apps/*`）。

- `packages/`：`core`、`engine`、`react`、`protocol`、`shared`、`builder` — 库包，`dist/` 由 tsup 产出。
- `apps/alien-mdm`：前端。Vite 8 + React 19 + antd 6，dev 端口 **5173**，`/api` 代理到 `localhost:8787`。
- `apps/alien-worker`：后端。Hono on Cloudflare Workers，wrangler dev 端口 **8787**，绑定本地 D1（库名 `alien-mdm`，迁移在 `apps/alien-worker/migrations`）。
- 根 `wrangler.json` 同时定义 worker 入口、assets 目录（`apps/alien-mdm/dist`）与 D1 绑定。

## 约定 / 注意
- API 前缀是 **`/api/v1/*`**（health 在 `/api/v1/health`），不是 `/api/*`。
- 前端依赖 `packages/*/dist`，仓库里已有构建产物；改库包源码后需 `pnpm --filter <pkg> build` 才生效。

## 本地启动（重要）
**用这个**：

```bash
pnpm dev:local          # -> node scripts/dev.mjs
```

它会：① 检查 `packages/{core,engine,protocol,react}` 的 dist 是否落后于 src，落后才重建；
② 应用本地 D1 迁移（幂等）；③ 并行启动 worker(8787) 与 web(5173)，日志带 `[worker]`/`[web]` 前缀。

**不要用根目录 `pnpm dev`**：worker 脚本里的 `VAR=x cmd` 前缀在 cmd.exe 下会失败。

也不要改成 `bash scripts/dev-windows.sh`（该文件已删除）：Git for Windows 只把
`C:\Program Files\Git\cmd` 加进 PATH，而 `bash.exe` 在 `C:\Program Files\Git\bin`，
**不在 PATH 上** —— 从 PowerShell / Windows Terminal 运行会找不到 bash。

`dev.mjs` 用 Node `spawn`（不经 shell）启动子进程，因此同时规避了
cmd 的环境变量前缀问题、MSYS 路径转换（本机设了 `MSYS_NO_PATHCONV=1`）
和 shell 垫片问题。跨平台可用。

默认管理员：`_sys_admin` / `alien123456`（见 `apps/alien-worker/src/domain/schemas/_sys_user.ts`）。

## 兜底路由（已修，勿回退）
`apps/alien-worker/src/index.ts` 的 `app.all("*")` 必须：
- 未匹配的 `/api/*` → 返回 404 JSON 信封（不要回落 SPA，否则接口 404 会伪装成 200 HTML）；
- 非 GET/HEAD → 405；只有 GET/HEAD 才转发给 `ASSETS.fetch`。

原因：把带 body 的请求转发给 `ASSETS.fetch` 会让 workerd 抛
`Can't read from request stream after response has been sent`，
该异常不受 Hono `onError` 保护，会直接打挂 wrangler dev 进程。

## 构建产物必须保持新鲜（重要）
`apps/*` 通过 package.json 的 `exports` 解析到 `packages/*/dist`，**不是 src**。
因此改了 `packages/*/src` 后不重建，dev 与 build 都会静默使用旧代码。

`scripts/dev.mjs` 已内置过期检测：对比 `packages/{core,engine,protocol,react}/src`
与各自 `dist/index.js` 的时间，过期才执行重建。

`builder` / `shared` 没有 src 也没有 build 脚本，是纯产物包，无需重建。

## 两个服务都能跑完整应用
- `http://localhost:5173` —— vite dev，带 HMR，`/api` 代理到 8787。**开发用这个**。
- `http://127.0.0.1:8787` —— wrangler，同时服务 `apps/alien-mdm/dist`。
  该 dist 只在 `pnpm --filter @alien-form/alien-mdm run build` 后更新，
  所以直连 8787 看到的是「最近一次构建」的版本，而不是当前源码。
