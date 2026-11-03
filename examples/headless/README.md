# 最小独立接入

只依赖 `formwork`、`solid-js` 和 Vite 的 Solid 插件，不导入 CMS 应用、Worker 或 Formwork 构建插件。

从仓库根目录执行：

```sh
pnpm --filter formwork build
pnpm exec vite examples/headless --config examples/headless/vite.config.ts --host 127.0.0.1
```

打开 `/list/notes` 可体验新建、查询、排序、分页、详情、编辑、删除和未保存提示。数据只保存在内存，刷新后清空。

- `api.ts` 实现 `FormworkApis`；接入真实服务时替换该适配器，并由服务端实施权限与版本检查。
- `main.tsx` 显式组装 `apis/components/ui/domains/pages`。默认 `Records` 复用应用提供的 UI，详情使用延迟 slot。
- `style.css` 使用 `.notes-app` 作用域和原生 CSS nesting，框架不附带视觉样式。

从根目录验证该示例：

```sh
pnpm exec tsc --noEmit -p examples/headless/tsconfig.json
pnpm exec vite build examples/headless --config examples/headless/vite.config.ts
```
