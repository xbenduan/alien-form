import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function login(page: Page, destination = "/models") {
  const credentials = JSON.parse(
    await readFile(join(process.env.FORMWORK_E2E_ROOT!, "login.json"), "utf8"),
  );
  await page.goto(destination);
  await expect(page.getByRole("heading", { name: "登录 Alien Form" })).toBeVisible();
  await page.getByLabel("用户名", { exact: true }).fill(credentials.username);
  await page.getByLabel("密码", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "模型工作台", exact: true })).toBeVisible();
  if (destination !== "/models") await page.goto(destination);
}
async function request(
  page: Page,
  path: string,
  method = "GET",
  data?: unknown,
  credential?: string,
) {
  const token =
    credential ?? (await page.evaluate(() => sessionStorage.getItem("formwork-user-session")));
  return page.request.fetch(`/api/v1${path}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
}
test.beforeEach(async ({ page }) => {
  await login(page);
});

test("orders：Filter 草稿、false、同 id 刷新、完整 Modal/Drawer", async ({ page }) => {
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

test("首页工作台和 MCP 直连 Worker 的 token 配置", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/models$/u);
  await expect(page.getByRole("textbox", { name: "完整 definition JSON" })).not.toHaveValue("");
  await expect(page.getByRole("navigation", { name: "主导航" }).getByRole("link")).toHaveCount(4);
  await page.getByRole("button", { name: /MCP 接入/u }).click();
  const config = JSON.parse(await page.getByLabel("MCP 客户端配置").innerText());
  expect(config.mcpServers.formwork.command).toBe("node");
  expect(config.mcpServers.formwork.args[0]).toMatch(/\/packages\/formwork\/dist\/stdio\.js$/u);
  expect(config.mcpServers.formwork.args.slice(1)).toEqual([
    "--url",
    "http://127.0.0.1:5184/api/v1",
  ]);
  expect(config.mcpServers.formwork.env.FORMWORK_API_TOKEN).toBe(
    "<在 API token 页面签发的 agent token>",
  );
  await expect(page.locator(".mcp-tools code")).toHaveCount(6);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/models$/u);
});

test("自绘 Select 支持键盘、分页与 Modal 浮层", async ({ page }) => {
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
  await status.click();
  await page.keyboard.press("Escape");
  await expect(status).toHaveAttribute("aria-expanded", "false");
  await expect(dialog).toBeVisible();
  await expect(status).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("取消保留调用者、History 返回、新建嵌套明细", async ({ page }) => {
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

test("cms Domain 从 ctx.schema 定制 RichText、Zod 与保存 fn", async ({ page }) => {
  const { definition } = await (await request(page, "/models/cms")).json();
  await page.goto("/edit/cms/article-1");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: `编辑${definition.document.title}` }),
  ).toBeVisible();
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

test("无效草稿、有效预览禁写、手动发布、刷新与旧页 422 保留输入", async ({ page, context }) => {
  const source = await (await request(page, "/models/orders")).json();
  const definition = structuredClone(source.definition);
  definition.document.id = "review-orders";
  definition.document.title = "审阅订单";
  definition.backend.storage.table = "biz_review_orders";
  definition.backend.storage.bindings.forEach((binding: { id: string }) => {
    binding.id = binding.id.replace("orders:", "review-orders:");
  });
  await page.getByLabel("新模型 ID", { exact: true }).fill("review-orders");
  await page.getByRole("button", { name: "新建模型", exact: true }).click();
  const json = page.getByRole("textbox", { name: "完整 definition JSON" });
  await json.fill(
    JSON.stringify({ ...definition, document: { ...definition.document, data: {} } }, null, 2),
  );
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "草稿诊断" }).getByRole("alert").first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "手动发布", exact: true })).toBeDisabled();
  expect((await request(page, "/runtime/models/review-orders")).status()).toBe(404);
  await json.fill(JSON.stringify(definition, null, 2));
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("校验通过");
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await expect(preview.getByRole("heading", { name: "审阅订单", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  await preview.getByLabel("订单号").fill("PREVIEW-ONLY");
  await preview.getByRole("button", { name: "保存", exact: true }).click();
  await expect(preview.getByRole("alert")).toContainText("预览不保存业务数据");
  expect((await request(page, "/runtime/models/review-orders")).status()).toBe(404);
  await page.getByRole("button", { name: "手动发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已手动发布版本 1");
  const created = await request(page, "/records/review-orders", "POST", {
    orderNo: "ORIGINAL",
    status: "pending",
    paid: false,
    amount: 10,
  });
  expect(created.ok()).toBe(true);
  const record = await created.json();
  const editor = await context.newPage();
  await login(editor, `/edit/review-orders/${record.id}`);
  await editor.getByRole("dialog").getByLabel("订单号").fill("kept");
  const ordinary = await context.newPage();
  await login(ordinary, "/list/review-orders");
  await expect(ordinary.getByRole("heading", { name: "审阅订单", exact: true })).toBeVisible();
  definition.document.title = "新发布订单";
  definition.document.data.properties.orderNo.minLength = 8;
  await json.fill(JSON.stringify(definition, null, 2));
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("尚未发布");
  await expect(ordinary.getByRole("heading", { name: "审阅订单", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "手动发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已手动发布版本 2");
  await expect(ordinary.getByRole("heading", { name: "审阅订单", exact: true })).toBeVisible();
  await ordinary.reload();
  await expect(ordinary.getByRole("heading", { name: "新发布订单", exact: true })).toBeVisible();
  const response = editor.waitForResponse(
    (result) =>
      result.url().includes(`/records/review-orders/${record.id}`) &&
      result.request().method() === "PUT",
  );
  await editor.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  expect((await response).status()).toBe(422);
  await expect(editor.getByRole("dialog").getByLabel("订单号")).toHaveValue("kept");
  await expect(
    editor.getByRole("dialog").getByRole("heading", { name: "编辑审阅订单" }),
  ).toBeVisible();
  await expect(editor.locator(".server-issues")).toContainText("/orderNo");
  await page
    .getByRole("region", { name: "发布版本" })
    .getByRole("button", { name: /^v1/u })
    .click();
  await expect(page.locator(".version-json")).toContainText("审阅订单");
  await editor.close();
  await ordinary.close();
});

test("agent CAS 冲突保留文本、无发布权限、UI token 撤销与注销", async ({ page }) => {
  const source = await (await request(page, "/models/orders")).json();
  const definition = structuredClone(source.definition);
  definition.document.id = "cas-model";
  definition.backend.storage.table = "biz_cas_model";
  expect(
    (await request(page, "/models/cas-model/draft", "PUT", { definition, ifRevision: null })).ok(),
  ).toBe(true);
  await page.goto("/tokens");
  await page.getByLabel("用途", { exact: true }).fill("E2E agent");
  await page.getByRole("button", { name: "签发 token", exact: true }).click();
  const token = page.getByLabel("token 明文", { exact: true });
  await expect(token).not.toHaveValue("");
  const agent = await token.inputValue();
  await page.goto("/models/cas-model");
  const json = page.getByRole("textbox", { name: "完整 definition JSON" });
  await expect(json).toHaveValue(/cas-model/u);
  const snapshot = await (await request(page, "/models/cas-model", "GET", undefined, agent)).json();
  await json.fill(
    JSON.stringify(
      { ...definition, document: { ...definition.document, title: "保留编辑文本" } },
      null,
      2,
    ),
  );
  expect(
    (
      await request(
        page,
        "/models/cas-model/draft",
        "PUT",
        {
          definition: {
            ...definition,
            document: { ...definition.document, title: "agent 最新草稿" },
          },
          ifRevision: snapshot.revision,
        },
        agent,
      )
    ).ok(),
  ).toBe(true);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("REVISION_CONFLICT");
  await expect(json).toHaveValue(/保留编辑文本/u);
  await page.getByRole("button", { name: "重新载入", exact: true }).click();
  await expect(json).toHaveValue(/agent 最新草稿/u);
  const latest = await (await request(page, "/models/cas-model", "GET", undefined, agent)).json();
  expect(
    (
      await request(
        page,
        "/models/cas-model/publish",
        "POST",
        { ifRevision: latest.revision },
        agent,
      )
    ).status(),
  ).toBe(403);
  await page.goto("/tokens");
  const row = page.getByRole("row").filter({ hasText: "E2E agent" });
  await row.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(row).toContainText("已撤销");
  expect((await request(page, "/models", "GET", undefined, agent)).status()).toBe(401);
  const session = await page.evaluate(() => sessionStorage.getItem("formwork-user-session"));
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await expect(page.getByRole("heading", { name: "登录 Alien Form" })).toBeVisible();
  expect((await request(page, "/auth/me", "GET", undefined, session!)).status()).toBe(401);
});

test("管理页桌面与移动布局无溢出", async ({ page }, info) => {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/models/orders");
    await expect(page.getByRole("button", { name: "退出", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "完整 definition JSON" })).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="模型管理预览"]')
        .getByRole("heading", { name: "订单", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  }
});
