import { expect, test } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

test("默认 orders：Filter 草稿、false、Table 同 id 刷新、完整 Modal/Drawer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/list/orders");
  await expect(page.getByRole("heading", { name: "订单", exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  const query = page.locator(".filters");
  await query.getByRole("combobox", { name: "已付款" }).click();
  await page.getByRole("option", { name: "否", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await query.getByRole("button", { name: "查询", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await query.getByRole("button", { name: "清空筛选" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  const row = page.locator('tr[data-record-id="order-1"]');
  await row.getByRole("button", { name: "编辑" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByRole("heading", { name: "编辑订单" })).toBeVisible();
  await modal.getByLabel("金额").fill("456");
  await modal.getByRole("button", { name: "保存", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(row).toContainText("456");
  await row.getByRole("button", { name: "详情" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "订单详情" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("456");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(row.getByRole("button", { name: "详情" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("首页进入模型工作台，MCP 配置匹配实际端口", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/models$/u);
  await expect(page.getByRole("heading", { name: "模型工作台", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "完整模型 JSON" })).not.toHaveValue("");
  await expect(page.getByRole("navigation", { name: "主导航" }).getByRole("link")).toHaveCount(3);
  await expect(page.getByText("工作区", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /MCP 接入/u }).click();
  const config = JSON.parse(await page.getByLabel("MCP 客户端配置").innerText());
  expect(config.mcpServers.formwork.command).toBe("node");
  expect(config.mcpServers.formwork.args[0]).toMatch(/\/packages\/formwork\/dist\/stdio\.js$/u);
  expect(config.mcpServers.formwork.args.slice(1)).toEqual(["--url", "http://127.0.0.1:5184"]);
  await expect(page.locator(".mcp-tools code")).toHaveCount(6);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/models$/u);
});

test("自绘 Select 支持键盘、分页和 Modal 内浮层，不触发意外提交", async ({ page }) => {
  await page.goto("/list/orders");
  const paid = page.locator(".filters").getByRole("combobox", { name: "已付款" });
  await paid.focus();
  await page.keyboard.press("ArrowDown");
  await expect(paid).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(paid).toContainText("否");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "清空筛选" }).click();
  await expect(paid).toContainText("未选择");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  const pageSize = page.getByRole("combobox", { name: "每页记录数" });
  await pageSize.focus();
  await page.keyboard.press("5");
  await expect(pageSize).toContainText("50 条 / 页");
  await page.getByRole("button", { name: "新建记录", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "编辑记录" });
  const status = dialog.getByRole("combobox", { name: "状态 *", exact: true });
  await status.click();
  await page.getByRole("option", { name: "已付款", exact: true }).click();
  await expect(status).toContainText("已付款");
  await expect(dialog).toBeVisible();
  await status.click();
  await page.keyboard.press("Escape");
  await expect(status).toHaveAttribute("aria-expanded", "false");
  await expect(dialog).toBeVisible();
  await expect(status).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
});

test("取消不保存、History 返回恢复调用者、新建嵌套明细", async ({ page }) => {
  await page.goto("/list/orders");
  await page.locator('tr[data-record-id="order-1"]').getByRole("button", { name: "编辑" }).click();
  await page.getByRole("dialog").getByLabel("订单号").fill("UNSAVED");
  await page.goBack();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/\/list\/orders$/u);
  await expect(page.locator('tr[data-record-id="order-1"]')).toContainText("SO-2026-001");
  await page.getByRole("button", { name: "新建记录" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("订单号").fill("SO-NEW");
  await dialog.getByRole("button", { name: "添加明细" }).click();
  await dialog.getByLabel("SKU").fill("SKU-NEW");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("tbody")).toContainText("SO-NEW");
});

test("cms 延迟覆盖实际 RichText 与保存 fn；Window 直达保持 Presenter", async ({ page }) => {
  const { document } = await (await page.request.get("/__formwork/models/cms")).json();
  await page.goto("/edit/cms/article-1");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `编辑${document.title}` })).toBeVisible();
  await dialog.getByLabel("标题").fill("  cms 已更新  ");
  await dialog.locator(".rich-editor").fill("完整正文\n第二行");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page).toHaveURL(/\/list\/cms$/u);
  await expect(page.locator("tbody")).toContainText("cms 已更新");
  await expect(page.locator("tbody")).toContainText("完整正文");
  await page.goto("/detail/cms/article-1");
  await expect(page.getByRole("dialog")).toContainText("完整正文");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/list\/cms$/u);
});

test("工作台 CAS、HMR 真实预览重挂载，普通编辑保留模型和值快照", async ({ page, context }) => {
  const editor = await context.newPage();
  await editor.goto("/edit/orders/order-1");
  await editor.getByRole("dialog").getByLabel("订单号").fill("保留未保存");
  await page.goto("/models/orders");
  const json = page.getByRole("textbox", { name: "完整模型 JSON" });
  await expect(json).toHaveValue(/"id": "orders"/u);
  const initial = JSON.parse(await json.inputValue());
  const first = await page.request.get("/__formwork/models/orders");
  const snapshot = await first.json();
  await json.fill(JSON.stringify({ ...initial, title: "草稿" }, null, 2));
  const file = join(process.env.FORMWORK_E2E_ROOT!, "local/src/models/orders/model.json");
  await writeFile(file, `${JSON.stringify({ ...initial, title: "外部新版本" }, null, 2)}\n`);
  await expect(page.getByRole("status")).toContainText("模型源已更新");
  await page.getByRole("button", { name: "保存模型", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("REVISION_CONFLICT");
  await page.getByRole("button", { name: "重新载入", exact: true }).click();
  await expect(json).toHaveValue(/外部新版本/u);
  await expect(
    page
      .frameLocator('iframe[title="模型实际预览"]')
      .getByRole("heading", { name: "外部新版本", exact: true }),
  ).toBeVisible();
  await expect(editor.getByRole("dialog").getByRole("heading", { name: "编辑订单" })).toBeVisible();
  await expect(editor.getByRole("dialog").getByLabel("订单号")).toHaveValue("保留未保存");
  const next = { ...initial, title: "HMR 已保存" };
  await json.fill(JSON.stringify(next, null, 2));
  await page.getByRole("button", { name: "保存模型", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存完整模型");
  await expect(
    page
      .frameLocator('iframe[title="模型实际预览"]')
      .getByRole("heading", { name: "HMR 已保存", exact: true }),
  ).toBeVisible();
  expect((await (await page.request.get("/__formwork/models/orders")).json()).revision).not.toBe(
    snapshot.revision,
  );
  await editor.close();
  await writeFile(file, `${JSON.stringify(initial, null, 2)}\n`);
});

test("remote 来源走完整 HTTP Adapter，上传明确且两源独立", async ({ page }) => {
  await page.goto("http://127.0.0.1:5186/models/orders");
  await expect(page.locator(".eyebrow")).toContainText("REMOTE");
  const json = page.getByRole("textbox", { name: "完整模型 JSON" });
  await expect(json).toHaveValue(/"id": "orders"/u);
  const original = JSON.parse(await json.inputValue());
  await json.fill(JSON.stringify({ ...original, title: "远端独立订单" }, null, 2));
  await page.getByRole("button", { name: "保存模型", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存完整模型");
  await expect(
    page
      .frameLocator('iframe[title="模型实际预览"]')
      .getByRole("heading", { name: "远端独立订单", exact: true }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5184/models/orders");
  await expect(json).toHaveValue(/"title": "订单"/u);
  await page.getByRole("button", { name: "上传到远端" }).click();
  await expect(page.getByRole("status")).toContainText("已上传");
  await page.goto("http://127.0.0.1:5186/list/orders");
  await expect(page.getByRole("heading", { name: "订单", exact: true })).toBeVisible();
  await expect(page.locator("tbody")).toContainText("SO-NEW");
});

test("模型文件新增、删除、坏 JSON 与修复刷新目录且源对象不变", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/models/orders");
  await expect(page.getByRole("textbox", { name: "完整模型 JSON" })).toBeVisible();
  await page.evaluate(async () => {
    const entryPath = "/src/models.ts";
    (globalThis as any).__formworkSource = (await import(entryPath)).localModels;
  });
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  const base = join(process.env.FORMWORK_E2E_ROOT!, "local/src/models");
  const extra = join(base, "inventory");
  const file = join(base, "orders/model.json");
  const original = await readFile(file, "utf8");
  try {
    await mkdir(extra, { recursive: true });
    await writeFile(
      join(extra, "model.json"),
      JSON.stringify({
        id: "inventory",
        title: "新增库存",
        data: { type: "object", properties: {} },
      }),
    );
    await expect(page.getByRole("button", { name: /新增库存/u })).toBeVisible();
    await rm(extra, { recursive: true });
    await expect(page.getByRole("button", { name: /新增库存/u })).toHaveCount(0);
    await writeFile(file, '{"broken":');
    await expect(page.getByRole("alert").first()).toContainText("INVALID_MODEL");
    await writeFile(file, original);
    await expect(page.getByRole("textbox", { name: "完整模型 JSON" })).toHaveValue(
      /"id": "orders"/u,
    );
    await expect(page.locator(".workbench > nav .model-card")).toHaveCount(2);
    expect(
      await page.evaluate(async () => {
        const entryPath = "/src/models.ts";
        return (globalThis as any).__formworkSource === (await import(entryPath)).localModels;
      }),
    ).toBe(true);
    expect(navigations).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await rm(extra, { recursive: true, force: true });
    await writeFile(file, original);
  }
});
