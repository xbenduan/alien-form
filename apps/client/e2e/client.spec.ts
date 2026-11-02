import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ModelDefinition } from "formwork/model";

async function login(page: Page, destination = "/models") {
  const credentials = JSON.parse(
    await readFile(join(process.env.FORMWORK_E2E_ROOT!, "login.json"), "utf8"),
  );
  await page.goto(destination);
  await expect(page.getByRole("heading", { name: "登录 Alien Form" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
  await expect(page.locator(".sidebar, header.topbar")).toHaveCount(0);
  await page.getByLabel("用户名", { exact: true }).fill(credentials.username);
  await page.getByLabel("密码", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "模型列表", exact: true })).toBeVisible();
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
async function fillJson(page: Page, value: string) {
  const editor = page.getByRole("textbox", { name: "完整 definition JSON" });
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await page.keyboard.insertText(value);
  await editor.press("ControlOrMeta+Home");
}
async function expectCompactWindow(window: Locator, floating = false) {
  await expect(window).toBeVisible();
  await expect(window.locator(".record-meta")).toHaveCount(0);
  const layout = await window.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
    const rect = element.getBoundingClientRect();
    const viewport = element.ownerDocument.defaultView!;
    const style = getComputedStyle(element);
    const heading = element.querySelector(".record-heading")!.getBoundingClientRect();
    const close = element.querySelector(".window-heading button")!.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: viewport.innerWidth - rect.right,
      bottom: viewport.innerHeight - rect.bottom,
      corners: [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ].map(Number.parseFloat),
      headingHeight: heading.height,
      closeWithinHeading: close.top >= heading.top && close.bottom <= heading.bottom,
    };
  });
  if (floating)
    for (const gap of [layout.left, layout.top, layout.right, layout.bottom])
      expect(gap).toBeGreaterThan(0);
  for (const corner of layout.corners) expect(corner).toBeGreaterThan(0);
  expect(layout.headingHeight).toBeLessThanOrEqual(64);
  expect(layout.closeWithinHeading).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await login(page);
});

test("共享 Domain 新建与编辑排除数据只读字段，服务端保留默认值", async ({ page }) => {
  const modelId = `readonly-${Date.now()}`;
  const definition: ModelDefinition = {
    document: {
      id: modelId,
      domain: "cms",
      title: "只读提交回归",
      data: {
        type: "object",
        properties: {
          title: { type: "string", title: "标题", minLength: 1 },
          content: { type: "string", title: "正文" },
        },
        required: ["title"],
      },
    },
    backend: {
      storage: {
        table: `biz_${modelId.replaceAll("-", "_")}`,
        bindings: [
          { id: "title", path: "/title", column: "title", sqlType: "TEXT", encoding: "scalar" },
          {
            id: "content",
            path: "/content",
            jsonKey: "content",
            sqlType: "TEXT",
            encoding: "scalar",
          },
        ],
      },
      relations: [],
      permissions: { grants: [], privateFields: [] },
      behavior: { rules: [], commands: {}, events: {} },
    },
  };
  definition.document.data.$defs = {
    locked: {
      type: "object",
      readOnly: true,
      default: { label: "服务端对象" },
      properties: { label: { type: "string" } },
    },
  };
  Object.assign(definition.document.data.properties, {
    readonlyText: { type: "string", title: "只读字段", readOnly: true, default: "服务端默认值" },
    readonlyObject: { $ref: "#/$defs/locked", title: "只读对象" },
    computed: { type: "integer", title: "UI 只读值", default: 0 },
    disabledText: { type: "string", title: "禁用值", default: "保留禁用值" },
  });
  definition.document.fields = {
    ...definition.document.fields,
    "/readonlyText": { table: false },
    "/readonlyObject": { table: false },
    "/computed": { form: { bindings: { readOnly: true } }, table: false, filter: false },
    "/disabledText": { form: { bindings: { disabled: true } }, table: false, filter: false },
  };
  definition.backend.storage.bindings.push(
    {
      id: "readonlyText",
      path: "/readonlyText",
      jsonKey: "readonlyText",
      sqlType: "TEXT",
      encoding: "scalar",
    },
    {
      id: "readonlyObject",
      path: "/readonlyObject",
      jsonKey: "readonlyObject",
      sqlType: "TEXT",
      encoding: "json",
    },
    {
      id: "computed",
      path: "/computed",
      jsonKey: "computed",
      sqlType: "INTEGER",
      encoding: "scalar",
    },
    {
      id: "disabledText",
      path: "/disabledText",
      jsonKey: "disabledText",
      sqlType: "TEXT",
      encoding: "scalar",
    },
  );
  try {
    const draft = await request(page, `/models/${modelId}/draft`, "PUT", {
      definition,
      ifRevision: null,
    });
    expect(draft.ok()).toBe(true);
    const saved = await draft.json();
    expect(saved.diagnostics.errors).toEqual([]);
    expect(
      (
        await request(page, `/models/${modelId}/publish`, "POST", { ifRevision: saved.revision })
      ).ok(),
    ).toBe(true);
    await page.goto(`/list/${modelId}`);
    await page.getByRole("button", { name: "新建记录", exact: true }).click();
    const editor = page.getByRole("dialog");
    await editor.getByLabel("标题").fill("  只读新增  ");
    await editor.locator(".rich-editor").fill("正文");
    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().endsWith(`/records/${modelId}`),
    );
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    const createdResponse = await createResponse;
    expect(createdResponse.status()).toBe(201);
    expect(createdResponse.request().postDataJSON()).toMatchObject({
      title: "只读新增",
      computed: 0,
      disabledText: "保留禁用值",
    });
    expect(createdResponse.request().postDataJSON()).not.toHaveProperty("readonlyText");
    expect(createdResponse.request().postDataJSON()).not.toHaveProperty("readonlyObject");
    const created = await createdResponse.json();
    expect(created).toMatchObject({
      readonlyText: "服务端默认值",
      readonlyObject: { label: "服务端对象" },
    });
    await expect(editor).not.toBeVisible();
    const row = page.locator("tbody tr").filter({ hasText: "只读新增" });
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    await editor.getByLabel("标题").fill("  只读编辑  ");
    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && response.url().includes(`/records/${modelId}/`),
    );
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    const updatedResponse = await updateResponse;
    expect(updatedResponse.ok()).toBe(true);
    expect(updatedResponse.request().postDataJSON()).not.toHaveProperty("readonlyText");
    expect(updatedResponse.request().postDataJSON()).not.toHaveProperty("readonlyObject");
    expect(await updatedResponse.json()).toMatchObject({
      title: "只读编辑",
      readonlyText: "服务端默认值",
      readonlyObject: { label: "服务端对象" },
    });
  } finally {
    await request(page, `/models/${modelId}`, "DELETE");
  }
});

test("旧深色偏好和系统深色模式不影响明亮首屏、独立页面与预览", async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem("alien-form-theme", "dark"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("table", { name: "模型列表", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "主题切换" })).toHaveCount(0);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#fff1e3");
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "light");
  expect(await root.evaluate((element) => getComputedStyle(element).colorScheme)).toBe("light");

  await page.goto("/models/orders");
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  await expect(preview.getByRole("dialog")).toBeVisible();
  await expect(preview.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await preview.locator("html").evaluate((element) => getComputedStyle(element).colorScheme),
  ).toBe("light");

  const other = await context.newPage();
  try {
    await other.emulateMedia({ colorScheme: "dark" });
    await other.goto("/login");
    await expect(other.getByRole("heading", { name: "登录 Alien Form" })).toBeVisible();
    await expect(other.locator(".sidebar, header.topbar")).toHaveCount(0);
    await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(other.getByRole("group", { name: "主题切换" })).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("共享 cms Domain 按模型读写，schema 的 Drawer、Page、Modal 与刷新直达一致", async ({
  page,
}) => {
  const { definition } = (await (await request(page, "/models/cms")).json()) as {
    definition: ModelDefinition;
  };
  const modelId = "shared-content";
  definition.document.id = modelId;
  definition.document.domain = "cms";
  definition.document.title = "共享内容";
  definition.document.pages = {
    list: {
      windows: {
        add: { openMode: "drawer" },
        edit: { openMode: "page" },
        detail: { openMode: "modal" },
      },
    },
  };
  definition.backend.storage.table = "biz_shared_content";
  const savedResponse = await request(page, `/models/${modelId}/draft`, "PUT", {
    definition,
    ifRevision: null,
  });
  expect(savedResponse.ok()).toBe(true);
  const saved = await savedResponse.json();
  expect(saved.diagnostics.errors).toEqual([]);
  expect(
    (
      await request(page, `/models/${modelId}/publish`, "POST", { ifRevision: saved.revision })
    ).ok(),
  ).toBe(true);
  await page.goto(`/list/${modelId}`);
  await page.getByRole("button", { name: "新建记录" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toHaveClass(/drawer/u);
  await drawer.getByLabel("标题").fill("  共享正文  ");
  await drawer.locator(".rich-editor").fill("第一行\n完整正文");
  await drawer.getByRole("button", { name: "保存", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  const record = page.locator("tbody tr").filter({ hasText: "共享正文" });
  await expect(record).toBeVisible();
  const id = await record.getAttribute("data-record-id");
  const reads: string[] = [];
  page.on("request", (incoming) => {
    if (incoming.method() === "GET" && incoming.url().includes(`/records/${modelId}/`))
      reads.push(incoming.url());
  });
  await record.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.locator(".record-form .rich-editor")).toHaveValue("第一行\n完整正文");
  await expect(page).toHaveURL(new RegExp(`/list/${modelId}/edit/`));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(reads).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".record-form .rich-editor")).toHaveValue("第一行\n完整正文");
  expect(reads).toHaveLength(2);
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/list/${modelId}$`));
  await expect(
    page.locator("header.topbar").getByRole("button", { name: "新建记录", exact: true }),
  ).toBeVisible();
  await record.getByRole("button", { name: "详情", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toHaveClass(/modal/u);
  await expect(modal.locator(".record-detail")).toContainText("完整正文");
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".record-detail")).toContainText("完整正文");
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  const rows = await (
    await request(page, `/records/${modelId}/query`, "POST", { filters: {}, page: 1, pageSize: 10 })
  ).json();
  expect(rows.list).toContainEqual(
    expect.objectContaining({ id, title: "共享正文", content: "第一行\n完整正文" }),
  );
});

test("浏览器禁用 localStorage 时明亮登录页仍正常输入", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "登录 Alien Form" })).toBeVisible();
    await page.getByLabel("用户名", { exact: true }).fill("kept-input");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByLabel("用户名", { exact: true })).toHaveValue("kept-input");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("本地 localhost 与 127.0.0.1 同端口均可登录，其他 Origin 仍被拒绝", async ({ page }) => {
  const localhost = "http://localhost:5184";
  const health = await page.request.get("/api/v1/health", { headers: { Origin: localhost } });
  expect(health.status()).toBe(200);
  await login(page, `${localhost}/models`);
  await expect(page.getByRole("table", { name: "模型列表", exact: true })).toBeVisible();
  for (const origin of [
    "http://localhost:5185",
    "https://evil.example",
    "http://localhost.evil:5184",
  ]) {
    const response = await page.request.get("/api/v1/health", { headers: { Origin: origin } });
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ error: { message: "客户端 Origin 未获允许" } });
  }
});

test("orders：Filter 草稿、false、同 id 刷新、完整 Modal/Page", async ({ page }) => {
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
  await expectCompactWindow(modal);
  await modal.getByLabel("金额").fill("456");
  await modal.getByRole("button", { name: "保存", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(row).toContainText("456");
  await row.getByRole("button", { name: "详情", exact: true }).click();
  await expect(
    page.locator("header.topbar").getByRole("heading", { name: "订单详情" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".record-detail")).toContainText("456");
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(page.locator(".record-detail")).toHaveCount(0);
  await expect(row.getByRole("button", { name: "详情", exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test("首页模型搜索与清除、固定操作列和 MCP 直连 Worker 配置", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/models$/u);
  await expect(page.getByRole("textbox", { name: "完整 definition JSON" })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "模型列表", exact: true })).toBeVisible();
  await expect(page.locator('tr[data-model-id="orders"]')).toBeVisible();
  const modelIds = await page
    .locator("tbody tr")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-model-id")));
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await expect(navigation.getByRole("link")).toHaveCount(5);
  expect(
    await navigation
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual([
    "/models",
    "/list/system-users",
    "/list/system-roles",
    "/list/system-model-categories",
    "/tokens",
  ]);
  await expect(page.locator("header.page-header")).toHaveCount(0);
  await expect(
    page.locator("header.topbar").getByRole("button", { name: "新建模型" }),
  ).toBeVisible();
  await expect(page.locator(".sidebar-bottom").getByRole("button", { name: "退出" })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "搜索模型" });
  await search.fill(" ORDERS ");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator('tr[data-model-id="orders"]')).toBeVisible();
  await search.fill("订单");
  await expect(page.locator('tr[data-model-id="orders"]')).toBeVisible();
  await search.fill("no-matching-model");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await expect(page.getByText("没有匹配的模型", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除搜索" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(modelIds.length);
  expect(
    await page
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-model-id"))),
  ).toEqual(modelIds);
  await page.setViewportSize({ width: 390, height: 844 });
  const operations = page.locator('tr[data-model-id="orders"] .operation-cell');
  expect(await operations.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");
  const bounds = await operations.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await operations.getByRole("button", { name: "详情", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "完整 definition JSON" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/models");
  await page.getByRole("button", { name: /MCP 接入/u }).click();
  const config = JSON.parse(await page.getByLabel("MCP 客户端配置").innerText());
  expect(config.mcpServers.formwork).toEqual({
    url: "http://127.0.0.1:5184/mcp",
    headers: { Authorization: "Bearer <在 API token 页面签发的 agent token>" },
  });
  await expect(page.getByText("HTTP/HTTPS · 客户端配置")).toBeVisible();
  const { token } = await (
    await request(page, "/auth/tokens", "POST", {
      label: "MCP E2E",
      expiresInDays: 1,
    })
  ).json();
  const mcp = await page.request.post(config.mcpServers.formwork.url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  expect(mcp.ok()).toBe(true);
  expect((await mcp.json()).result.tools).toHaveLength(7);
  await expect(page.locator(".mcp-tools code")).toHaveCount(7);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/models$/u);
});

test("固定用户模型在独立登录中同步，取消后保留业务页面与系统分组", async ({ page, browser }) => {
  const row = page.locator('tr[data-model-id="orders"]');
  const nav = page.getByRole("navigation", { name: "主导航" });
  await expect(
    nav.getByRole("link", { name: "模型列表", exact: true }).locator("svg"),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "API token", exact: true }).locator("svg"),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "订单", exact: true })).toHaveCount(0);
  await row.getByRole("button", { name: "固定到菜单", exact: true }).click();
  await expect(row.getByRole("button", { name: "取消固定", exact: true })).toBeEnabled();
  await expect(nav.getByRole("link", { name: "订单", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: /已固定模型/u }).click();
  await expect(nav.getByRole("button", { name: /已固定模型/u })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("#pinned-model-links")).not.toBeVisible();
  await nav.getByRole("link", { name: "API token", exact: true }).click();
  await expect(page.getByRole("heading", { name: "API token", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: /已固定模型/u })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await nav.getByRole("button", { name: /已固定模型/u }).click();
  await expect(nav.getByRole("link", { name: "订单", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "订单", exact: true }).click();
  await expect(page).toHaveURL(/\/list\/orders$/u);
  await expect(nav.getByRole("link", { name: "订单", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.locator("header.topbar").getByRole("button", { name: "查看模型" }),
  ).toBeVisible();
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await login(second);
    const secondRow = second.locator('tr[data-model-id="orders"]');
    await expect(secondRow.getByRole("button", { name: "取消固定", exact: true })).toBeEnabled();
    await secondRow.getByRole("button", { name: "取消固定", exact: true }).click();
    await expect(
      second
        .getByRole("navigation", { name: "主导航" })
        .getByRole("link", { name: "订单", exact: true }),
    ).toHaveCount(0);
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(nav.getByRole("link", { name: "订单", exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/\/list\/orders$/u);
    await expect(page.getByRole("heading", { name: "订单", exact: true })).toBeVisible();
    await nav.getByRole("link").filter({ hasText: "用户" }).click();
    await expect(page).toHaveURL(/\/list\/system-users$/u);
    await page.goto("/models");
    await page
      .locator('tr[data-model-id="orders"]')
      .getByRole("button", { name: "详情", exact: true })
      .click();
    await expect(page).toHaveURL(/\/models\/orders$/u);
    await page.goBack();
    await expect(page).toHaveURL(/\/models$/u);
  } finally {
    await other.close();
  }
});

test("新建草稿不能固定，发布后开放固定且不自动添加菜单", async ({ page }) => {
  await page.getByRole("button", { name: "新建模型", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("新模型 ID").fill("menu-created");
  await dialog.getByRole("button", { name: "创建模型", exact: true }).click();
  await expect(page).toHaveURL(/\/models\/menu-created$/u);
  await page
    .locator("header.topbar")
    .getByRole("button", { name: "模型列表", exact: true })
    .click();
  const row = page.locator('tr[data-model-id="menu-created"]');
  await expect(row.getByRole("button", { name: "固定到菜单" })).toBeDisabled();
  await expect(row).toContainText("发布后可固定");
  await row.getByRole("button", { name: "详情", exact: true }).click();
  await page.getByRole("button", { name: "手动发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已手动发布版本 1");
  await page
    .locator("header.topbar")
    .getByRole("button", { name: "模型列表", exact: true })
    .click();
  await expect(row.getByRole("button", { name: "固定到菜单" })).toBeEnabled();
  await expect(
    page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("link", { name: "menu-created", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "新建模型", exact: true }).click();
  await page.getByLabel("新模型 ID").fill("menu-created");
  await page.getByRole("button", { name: "创建模型", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("新模型 ID")).toHaveValue("menu-created");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("分隔条指针和键盘调整保留 iframe 表单与 Schema 文本，窄屏上下排列", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/models/orders");
  const json = page.getByRole("textbox", { name: "完整 definition JSON" });
  const { definition } = await (await request(page, "/models/orders")).json();
  const original = JSON.stringify(definition, null, 2);
  await expect(json).toContainText(definition.document.title);
  const editor = await json.elementHandle();
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  const form = preview.getByRole("dialog");
  await form.getByLabel("订单号").fill("DRAG-KEPT");
  const frame = await page.locator("iframe").elementHandle();
  const separator = page.getByRole("separator", { name: "调整 Schema 与预览宽度" });
  const initial = await page.locator(".source-panel").boundingBox();
  const handle = (await separator.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 160);
  await page.mouse.down();
  await page.mouse.move(handle.x + 150, handle.y + 160, { steps: 12 });
  expect(await separator.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
    "none",
  );
  await page.mouse.up();
  expect((await page.locator(".source-panel").boundingBox())!.width).toBeGreaterThan(
    initial!.width + 100,
  );
  expect(
    await page.locator("iframe").evaluate((element, previous) => element === previous, frame),
  ).toBe(true);
  await expect(form.getByLabel("订单号")).toHaveValue("DRAG-KEPT");
  expect(await json.evaluate((element, previous) => element === previous, editor)).toBe(true);
  await expect(json).toContainText(definition.document.title);
  await separator.focus();
  const value = Number(await separator.getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowLeft");
  expect(Number(await separator.getAttribute("aria-valuenow"))).toBeLessThan(value);
  await page.keyboard.press("Home");
  expect(Number(await separator.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(
    Number(await separator.getAttribute("aria-valuemin")),
  );
  expect((await page.locator(".source-panel").boundingBox())!.width).toBeGreaterThanOrEqual(279);
  await page.keyboard.press("End");
  expect(Number(await separator.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(
    Number(await separator.getAttribute("aria-valuemax")),
  );
  expect((await page.locator(".preview-panel").boundingBox())!.width).toBeGreaterThanOrEqual(279);
  const changed = original.replace(
    JSON.stringify(definition.document.title),
    JSON.stringify("拖动保留草稿"),
  );
  await fillJson(page, changed);
  await expect(preview.getByRole("heading", { name: "新建拖动保留草稿", exact: true })).toHaveCount(
    0,
  );
  await expect(preview.getByRole("heading", { name: "拖动保留草稿", exact: true })).toBeVisible();
  await separator.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(json).toContainText("拖动保留草稿");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(separator).not.toBeVisible();
  const left = (await page.locator(".source-panel").boundingBox())!;
  const right = (await page.locator(".preview-panel").boundingBox())!;
  expect(right.y).toBeGreaterThan(left.y + left.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Schema、JSON 节点和诊断独立折叠，保留草稿及预览表单", async ({ page }) => {
  const current = await (await request(page, "/models/orders")).json();
  expect(
    (
      await request(page, "/models/orders/draft", "PUT", {
        definition: current.definition,
        ifRevision: current.revision,
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/models/orders");
  const json = page.getByRole("textbox", { name: "完整 definition JSON" });
  await expect(json).toBeVisible();
  const diagnostics = page.getByRole("region", { name: "草稿诊断" });
  const diagnosticsToggle = diagnostics.getByRole("button", { name: "草稿诊断", exact: true });
  await expect(diagnosticsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(diagnosticsToggle).toContainText("无错误");
  await expect(page.locator(".draft-state")).toHaveCount(1);
  await expect(page.locator(".editor-toolbar, .editor-footer, .json-fold-actions")).toHaveCount(0);
  const {
    definition,
    diagnostics: report,
    revision,
  } = await (await request(page, "/models/orders")).json();
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  const form = preview.getByRole("dialog");
  await form.getByLabel("订单号").fill("COLLAPSE-KEPT");
  await expect(preview.locator(".preview-notice")).toHaveCount(0);
  const standalone = await page.context().newPage();
  try {
    const url = new URL(`/model-preview/orders?revision=${revision}`, page.url());
    await login(standalone);
    await standalone.goto(url.href);
    await expect(standalone.locator(".preview-notice")).toContainText("数据仅保存在当前预览内存中");
    await expect(standalone.locator("tbody tr")).toHaveCount(0);
  } finally {
    await standalone.close();
  }
  const frame = await page.locator("iframe").elementHandle();
  const editor = await json.elementHandle();
  await page.locator('.json-fold-toggle[title="折叠 JSON 节点"]:visible').first().click();
  await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(1);
  await page.locator('.json-fold-toggle[title="展开 JSON 节点"]:visible').first().click();
  await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(0);
  await page.getByRole("button", { name: "Schema JSON", exact: true }).click();
  await expect(json).not.toBeVisible();
  await diagnosticsToggle.click();
  await expect(diagnosticsToggle).toHaveAttribute("aria-expanded", "true");
  const runtimeChecks = report.runtimeChecks as Array<{
    code: string;
    message: string;
    router?: string;
    path: string;
  }>;
  const groups = new Set(runtimeChecks.map((issue) => JSON.stringify([issue.code, issue.message])));
  expect(runtimeChecks.length).toBeGreaterThan(groups.size);
  await expect(diagnostics.locator(".runtime-check")).toHaveCount(groups.size);
  const labels: Record<string, string> = {
    list: "记录列表",
    add: "新建记录",
    edit: "编辑记录",
    detail: "记录详情",
  };
  for (const router of new Set(runtimeChecks.map((issue) => issue.router))) {
    if (router) {
      await expect(diagnostics).toContainText(labels[router] ?? router);
    }
  }
  await diagnosticsToggle.click();
  await expect(diagnostics.getByText("没有可确定错误。", { exact: true })).not.toBeVisible();
  await expect(form.getByLabel("订单号")).toHaveValue("COLLAPSE-KEPT");
  await page.getByRole("button", { name: "Schema JSON", exact: true }).click();
  await expect(json).toBeVisible();
  expect(await json.evaluate((element, previous) => element === previous, editor)).toBe(true);
  expect(
    await page.locator("iframe").evaluate((element, previous) => element === previous, frame),
  ).toBe(true);
  await expect(form.getByLabel("订单号")).toHaveValue("COLLAPSE-KEPT");
  definition.document.title = "折叠保留草稿";
  await fillJson(page, JSON.stringify(definition, null, 2));
  await page.getByRole("button", { name: "Schema JSON", exact: true }).click();
  await page.getByRole("button", { name: "Schema JSON", exact: true }).click();
  await expect(json).toContainText("折叠保留草稿");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
  await diagnosticsToggle.click();
  await expect(diagnostics).toContainText("保存后返回最新诊断。");
});

test("实时预览从空列表新增，CRUD、筛选和 Schema 重建保留前端缓存且不请求记录接口", async ({
  page,
}) => {
  const errors: string[] = [];
  const previewRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().frame().parentFrame()) {
      previewRequests.push(route.request().url());
      await route.abort("failed");
    } else await route.continue();
  });
  const query = { filters: {}, page: 1, pageSize: 50 };
  const original = await (await request(page, "/records/orders/query", "POST", query)).json();
  const { definition } = await (await request(page, "/models/orders")).json();
  await page.goto("/models/orders");
  await expect(page.getByRole("heading", { name: "实时预览", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "预览页面" })).toHaveCount(0);
  await expect(page.getByLabel("预览记录 ID")).toHaveCount(0);
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await expect(preview.locator("tbody tr")).toHaveCount(0);
  const dialog = preview.getByRole("dialog");
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  await dialog.getByLabel("订单号").fill("LOCAL-FIRST");
  await dialog.getByLabel("金额").fill("120");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const row = preview.getByRole("row").filter({ hasText: "LOCAL-FIRST" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "详情", exact: true }).click();
  await expect(preview.getByRole("heading", { name: "订单详情", exact: true })).toBeVisible();
  await expect(preview.locator(".record-page-panel")).toHaveCSS("border-top-style", "solid");
  await expect(preview.locator(".record-detail")).toContainText("LOCAL-FIRST");
  await preview.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(preview.locator(".record-detail")).toHaveCount(0);
  await expect(row.getByRole("button", { name: "详情", exact: true })).toBeFocused();
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await expectCompactWindow(dialog);
  await dialog.getByLabel("金额").fill("987");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText("987");
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await dialog.getByLabel("金额").fill("123");
  await dialog.getByLabel("金额").press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText("987");
  await expect(row.getByRole("button", { name: "编辑", exact: true })).toBeFocused();
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  await expectCompactWindow(dialog);
  await dialog.getByLabel("订单号").fill("LOCAL-CREATED");
  await dialog.getByRole("button", { name: "添加明细", exact: true }).click();
  await dialog.getByLabel("SKU").fill("LOCAL-SKU");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  const created = preview.getByRole("row").filter({ hasText: "LOCAL-CREATED" });
  await created.getByRole("button", { name: "详情", exact: true }).click();
  await expect(preview.locator(".record-detail")).toContainText("LOCAL-SKU");
  await preview.getByRole("button", { name: "返回列表", exact: true }).click();
  const filters = preview.getByRole("form", { name: "筛选记录" });
  await filters.getByLabel("订单号", { exact: true }).fill("LOCAL-CREATED");
  await filters.getByRole("button", { name: "查询", exact: true }).click();
  await expect(preview.locator("tbody tr")).toHaveCount(1);
  await preview.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(preview.locator("tbody tr")).toHaveCount(1);
  await filters.getByRole("button", { name: "清空筛选", exact: true }).click();
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  await created.getByRole("button", { name: "删除", exact: true }).click();
  await expect(preview.locator("tbody tr")).toHaveCount(1);
  definition.document.title = "缓存订单";
  await fillJson(page, JSON.stringify(definition, null, 2));
  await expect(preview.getByRole("heading", { name: "缓存订单", exact: true })).toBeVisible();
  await expect(row).toContainText("987");
  expect(await (await request(page, "/records/orders/query", "POST", query)).json()).toEqual(
    original,
  );
  expect(previewRequests).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page).toHaveURL(/\/models\/orders$/u);
  await page.goto("/tokens");
  await expect(page.getByRole("heading", { name: "API token", exact: true })).toBeVisible();
  await expect(page.locator(".sidebar-bottom").getByRole("button", { name: "退出" })).toBeVisible();
});

test("未保存 Schema 实时更新，backend 与无效 JSON 保留当前预览输入", async ({ page }) => {
  const { definition } = await (await request(page, "/models/orders")).json();
  await page.goto("/models/orders");
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await expect(preview.locator("tbody tr")).toHaveCount(0);
  const frame = await page.locator("iframe").elementHandle();
  definition.document.title = "实时订单";
  definition.document.data.properties.previewTag = {
    type: "string",
    title: "预览字段",
    default: "自动示例",
  };
  await fillJson(page, JSON.stringify(definition, null, 2));
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
  await expect(preview.getByRole("heading", { name: "实时订单", exact: true })).toBeVisible();
  await expect(preview.getByRole("columnheader", { name: "预览字段", exact: true })).toBeVisible();
  await expect(preview.locator("tbody tr")).toHaveCount(0);
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  const dialog = preview.getByRole("dialog");
  await dialog.getByLabel("订单号").fill("UNSAVED-PREVIEW");
  await expect(dialog.getByLabel("预览字段")).toHaveValue("自动示例");
  await dialog.getByLabel("预览字段").fill("KEPT-PREVIEW");
  definition.backend.storage.table = "preview_backend_only";
  const valid = JSON.stringify(definition, null, 2);
  await fillJson(page, valid);
  await expect(dialog.getByLabel("订单号")).toHaveValue("UNSAVED-PREVIEW");
  await expect(dialog.getByLabel("预览字段")).toHaveValue("KEPT-PREVIEW");
  await fillJson(page, valid.slice(0, -1));
  await expect(preview.locator(".preview-status")).toContainText("JSON 编辑中");
  await expect(dialog.getByLabel("预览字段")).toHaveValue("KEPT-PREVIEW");
  await fillJson(
    page,
    JSON.stringify(
      {
        ...definition,
        document: { ...definition.document, data: {} },
      },
      null,
      2,
    ),
  );
  await expect(preview.locator(".preview-status")).toContainText("Schema 暂不可预览");
  await expect(dialog.getByLabel("预览字段")).toHaveValue("KEPT-PREVIEW");
  await fillJson(page, valid);
  await expect(preview.locator(".preview-status")).toHaveCount(0);
  await expect(dialog.getByLabel("预览字段")).toHaveValue("KEPT-PREVIEW");
  expect(
    await page.locator("iframe").evaluate((element, previous) => element === previous, frame),
  ).toBe(true);
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(preview.getByRole("row").filter({ hasText: "UNSAVED-PREVIEW" })).toContainText(
    "KEPT-PREVIEW",
  );
});

test("外层会话核实网络失败可重试，真实 401 清理会话与菜单", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/auth/me", async (route) => {
    if (fail) await route.abort("failed");
    else await route.continue();
  });
  await page.goto("/models");
  await expect(page.getByRole("alert")).toContainText("登录会话核实失败");
  expect(await page.evaluate(() => !!sessionStorage.getItem("formwork-user-session"))).toBe(true);
  await expect(page.getByRole("table", { name: "模型列表", exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "重试登录验证" }).click();
  await expect(page.getByRole("table", { name: "模型列表", exact: true })).toBeVisible();
  await page.unroute("**/api/v1/auth/me");
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "会话已撤销" } }),
    }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "登录 Alien Form", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("formwork-user-session"))).toBeNull();
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "用户管理" }),
  ).toHaveCount(0);
});

test("自绘 Select 支持键盘、分页与 Modal 浮层", async ({ page }) => {
  await page.goto("/list/orders");
  const paid = page.locator(".filters").getByRole("combobox", { name: "已付款" });
  await paid.click();
  // 模拟鼠标打开后焦点不落在按钮上的浏览器行为。
  await paid.evaluate((element) => (element as HTMLElement).blur());
  await page.keyboard.press("Escape");
  await expect(paid).toHaveAttribute("aria-expanded", "false");
  await expect(paid).toBeFocused();
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
  const dialog = page.getByRole("dialog", { name: "新建记录" });
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
  await expect(page).toHaveURL(/\/list\/cms\/edit\/article-1$/u);
  const editor = page.locator(".record-form");
  await expect(
    page
      .locator("header.topbar")
      .getByRole("heading", { name: `编辑${definition.document.title}` }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await editor.getByLabel("标题").fill("  cms 已更新  ");
  await editor.locator(".rich-editor").fill("完整正文\n第二行");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page).toHaveURL(/\/list\/cms$/u);
  await expect(page.locator("tbody")).toContainText("cms 已更新");
  await expect(page.locator("tbody")).toContainText("完整正文");
  await page.goto("/detail/cms/article-1");
  await expect(page).toHaveURL(/\/list\/cms\/detail\/article-1$/u);
  await expect(page.locator(".record-detail")).toContainText("完整正文");
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(page).toHaveURL(/\/list\/cms$/u);
});

test("组织架构从空 treelist 手动新增三级部门，切换视图保留本地缓存", async ({ page }) => {
  const definition: ModelDefinition = JSON.parse(
    await readFile("examples/departments.definition.json", "utf8"),
  );
  const saved = await request(page, "/models/departments/draft", "PUT", {
    definition,
    ifRevision: null,
  });
  expect(saved.ok()).toBe(true);
  expect((await saved.json()).diagnostics.errors).toEqual([]);
  const previewRequests: string[] = [];
  page.on("request", (incoming) => {
    if (incoming.frame().parentFrame() && incoming.url().includes("/api/v1/"))
      previewRequests.push(incoming.url());
  });
  await page.goto("/models/departments");
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  const tree = preview.getByRole("complementary", { name: "组织架构层级" });
  await expect(tree).toContainText("暂无层级记录");
  await expect(preview.locator("tbody tr")).toHaveCount(0);
  const ids: string[] = [];
  for (const name of ["总部", "产品部", "研发组"]) {
    await preview.getByRole("button", { name: "新建记录", exact: true }).click();
    const drawer = preview.getByRole("dialog");
    await drawer.getByPlaceholder("输入部门名称").fill(name);
    if (ids.length) await drawer.getByLabel("上级部门 ID").fill(ids.at(-1)!);
    await drawer.getByRole("button", { name: "保存", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    const row = preview.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    ids.push((await row.getAttribute("data-record-id"))!);
  }
  await expect(tree.getByRole("button", { name: "研发组", exact: true })).toBeVisible();
  await expect(tree.locator("details")).toHaveCount(2);
  await expect(preview.locator("tbody tr")).toHaveCount(3);
  await tree.getByRole("button", { name: "总部", exact: true }).click();
  await expect(preview.locator("tbody tr")).toHaveCount(1);
  await expect(preview.locator("tbody")).toContainText("产品部");
  await expect(preview.locator("tbody")).not.toContainText("研发组");
  await preview.getByRole("button", { name: "编辑", exact: true }).click();
  const drawer = preview.getByRole("dialog");
  await drawer.getByPlaceholder("输入部门名称").fill("研发部门");
  await drawer.getByRole("button", { name: "保存", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(tree.getByRole("button", { name: "研发部门", exact: true })).toBeVisible();
  await expect(preview.locator("tbody tr")).toHaveCount(1);
  await preview.getByRole("button", { name: "列表视图", exact: true }).click();
  await expect(tree).toHaveCount(0);
  await expect(preview.locator("tbody tr")).toHaveCount(3);
  await expect(preview.locator("tbody")).toContainText("研发部门");
  await preview.getByRole("button", { name: "树形视图", exact: true }).click();
  await expect(tree.getByRole("button", { name: "研发部门", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await preview.locator(".tree-list-page").evaluate((element) => {
    const tree = element.querySelector(".tree-panel")!.getBoundingClientRect();
    const list = element.querySelector(".list-page")!.getBoundingClientRect();
    return {
      above: tree.bottom <= list.top,
      overflow:
        element.ownerDocument.documentElement.scrollWidth >
        element.ownerDocument.defaultView!.innerWidth,
    };
  });
  expect(layout).toEqual({ above: true, overflow: false });
  expect(previewRequests).toEqual([]);
});

test("行内字段详情保留 Domain、完整记录表达式、数组通配配置与转义路径", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const definition: ModelDefinition = JSON.parse(
    await readFile("examples/customer-profile.definition.json", "utf8"),
  );
  const modelId = "inline-field-details";
  definition.document.id = modelId;
  definition.document.domain = "cms";
  definition.document.data.properties.content = { type: "string", title: "正文" };
  definition.document.data.properties["tags/~"] = {
    type: "array",
    title: "数字标签",
    items: { type: "number" },
  };
  const addresses = definition.document.data.properties.addresses!;
  if (!("items" in addresses) || !("properties" in addresses.items))
    throw new Error("联系地址必须是对象数组");
  addresses.items.properties.tags = {
    type: "array",
    title: "地址标签",
    items: { type: "string" },
  };
  definition.document.fields = {
    ...definition.document.fields,
    "/content": { table: false, filter: false },
    "/profile": { table: { title: "客户资料" }, filter: false },
    "/profile/industry": { form: { component: "RichText" } },
    "/profile/contact/email": {
      form: { bindings: { visible: "{{ $values.name === '行内客户' }}" } },
    },
    "/addresses/*/city": { form: { component: "RichText" } },
  };
  definition.backend.storage = {
    table: "biz_inline_field_details",
    bindings: [
      ...definition.backend.storage.bindings,
      {
        id: "inline:content",
        path: "/content",
        column: "content",
        sqlType: "TEXT",
        encoding: "scalar",
      },
      { id: "inline:tags", path: "/tags~1~0", column: "tags", sqlType: "TEXT", encoding: "json" },
    ],
  };
  const saved = await request(page, `/models/${modelId}/draft`, "PUT", {
    definition,
    ifRevision: null,
  });
  expect(saved.ok()).toBe(true);
  const snapshot = await saved.json();
  expect(snapshot.diagnostics.errors).toEqual([]);
  expect(
    (
      await request(page, `/models/${modelId}/publish`, "POST", {
        ifRevision: snapshot.revision,
      })
    ).ok(),
  ).toBe(true);
  const value = {
    name: "行内客户",
    content: "完整记录正文",
    profile: {
      industry: "科技服务\n第二行",
      contact: { name: "张晓", email: "contact@example.com" },
    },
    addresses: [
      { city: "上海市\n浦东新区", primary: false, tags: ["办公", "收货"] },
      { city: "杭州市", primary: true },
    ],
    "tags/~": [0, 2],
  };
  const created = await request(page, `/records/${modelId}`, "POST", value);
  expect(created.ok()).toBe(true);
  const record = await created.json();
  const other = await request(page, `/records/${modelId}`, "POST", {
    ...value,
    name: "另一客户",
  });
  expect(other.ok()).toBe(true);
  await page.goto(`/list/${modelId}`);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "行内客户", exact: true }) });
  await expect(row).toBeVisible();
  await expect(row.locator(".array-item, .object-fields")).toHaveCount(0);
  await expect(row.locator('[data-field-path="/profile"] .complex-summary')).toHaveText(
    "已配置 2 项",
  );
  await expect(row.locator('[data-field-path="/addresses"] .complex-summary')).toHaveText(
    "共 2 项",
  );
  const reads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(`/api/v1/records/${modelId}`)) reads.push(request.url());
  });
  const url = page.url();
  const profileButton = row.getByRole("button", { name: "查看客户资料详情", exact: true });
  await profileButton.focus();
  await profileButton.press("Enter");
  const modal = page.getByRole("dialog", { name: "客户资料详情", exact: true });
  await expectCompactWindow(modal);
  await expect(modal.locator(".rich-text")).toHaveText("科技服务\n第二行");
  await expect(modal).toContainText("contact@example.com");
  await expect(modal).not.toContainText("完整记录正文");
  await expect(modal.locator('fieldset[data-field-path="/profile/contact"]')).toBeVisible();
  await expect(modal.locator("input, textarea, select, .complex-cell")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(profileButton).toBeFocused();
  const addressesButton = row.getByRole("button", { name: "查看联系地址详情", exact: true });
  await addressesButton.click();
  const addressesModal = page.getByRole("dialog", { name: "联系地址详情", exact: true });
  await expect(addressesModal.locator(".rich-text")).toHaveText(["上海市\n浦东新区", "杭州市"]);
  await expect(addressesModal.locator(".array-item")).toHaveCount(4);
  await expect(addressesModal).toContainText("办公");
  await expect(addressesModal).toContainText("收货");
  await expect(
    addressesModal.getByRole("button", { name: /添加明细|删除明细|上移|下移/u }),
  ).toHaveCount(0);
  await expect(addressesModal.locator("input, textarea, select, .complex-cell")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await addressesModal.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: element.ownerDocument.defaultView!.innerWidth - rect.right,
      overflow: element.scrollWidth > element.clientWidth,
    };
  });
  expect(layout.left).toBeGreaterThan(0);
  expect(layout.right).toBeGreaterThan(0);
  expect(layout.overflow).toBe(false);
  await addressesModal.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await expect(addressesModal).toHaveCount(0);
  await expect(addressesButton).toBeFocused();
  await row.getByRole("button", { name: "查看数字标签详情", exact: true }).click();
  const tagsModal = page.getByRole("dialog", { name: "数字标签详情", exact: true });
  await expect(tagsModal.locator(".array-item")).toHaveCount(2);
  await expect(tagsModal.locator(".array-item").first()).toContainText("0");
  await page.keyboard.press("Escape");
  await page
    .getByRole("row")
    .filter({ hasText: "另一客户" })
    .getByRole("button", { name: "查看客户资料详情", exact: true })
    .click();
  await expect(modal).toContainText("张晓");
  await expect(modal).not.toContainText("contact@example.com");
  await page.keyboard.press("Escape");
  expect(page.url()).toBe(url);
  expect(reads).toEqual([]);
  const updated = await request(page, `/records/${modelId}/${record.id}`, "PUT", {
    ...value,
    profile: { industry: "更新行业", contact: { name: "李明", email: "new@example.com" } },
  });
  expect(updated.ok()).toBe(true);
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await profileButton.click();
  await expect(modal).toContainText("更新行业");
  await expect(modal).toContainText("李明");
  await expect(modal).not.toContainText("张晓");
  expect(errors).toEqual([]);
});

test("行内字段详情区分缺失、null、空对象与空数组", async ({ page }) => {
  const definition: ModelDefinition = JSON.parse(
    await readFile("examples/customer-profile.definition.json", "utf8"),
  );
  const modelId = "empty-field-details";
  definition.document.id = modelId;
  definition.backend.storage.table = "biz_empty_field_details";
  const saved = await request(page, `/models/${modelId}/draft`, "PUT", {
    definition,
    ifRevision: null,
  });
  const snapshot = await saved.json();
  expect(snapshot.diagnostics.errors).toEqual([]);
  expect(
    (
      await request(page, `/models/${modelId}/publish`, "POST", {
        ifRevision: snapshot.revision,
      })
    ).ok(),
  ).toBe(true);
  await page.route(`**/api/v1/records/${modelId}/query`, (route) =>
    route.fulfill({
      json: {
        list: [
          { id: "missing", name: "缺失字段" },
          { id: "null", name: "null 字段", profile: null, addresses: null },
          { id: "empty", name: "空字段", profile: {}, addresses: [] },
        ],
        total: 3,
      },
    }),
  );
  await page.goto(`/list/${modelId}`);
  for (const name of ["缺失字段", "null 字段", "空字段"]) {
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row.locator(".complex-summary")).toHaveText(["—", "—"]);
    await row.getByRole("button", { name: "查看基本资料详情", exact: true }).click();
    const modal = page.getByRole("dialog");
    if (name === "空字段") {
      await expect(modal.locator('fieldset[data-field-path="/profile"]')).toBeVisible();
      await expect(modal.locator("input, textarea")).toHaveCount(0);
    } else await expect(modal).toContainText("暂无字段详情");
    await page.keyboard.press("Escape");
    await row.getByRole("button", { name: "查看联系地址详情", exact: true }).click();
    await expect(modal).toContainText(name === "空字段" ? "暂无明细" : "暂无字段详情");
    await page.keyboard.press("Escape");
    await expect(row.getByRole("button", { name: "查看联系地址详情", exact: true })).toBeFocused();
  }
});

test("客户档案手动录入对象和数组，legend 嵌在虚线中且详情仅垂直居中", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const definition: ModelDefinition = JSON.parse(
    await readFile("examples/customer-profile.definition.json", "utf8"),
  );
  const saved = await request(page, "/models/customer-profile/draft", "PUT", {
    definition,
    ifRevision: null,
  });
  expect(saved.ok()).toBe(true);
  expect((await saved.json()).diagnostics.errors).toEqual([]);
  await page.goto("/models/customer-profile");
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await expect(preview.locator("tbody tr")).toHaveCount(0);
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  const editor = preview.getByRole("dialog");
  await editor.getByLabel("客户名称").fill(`测试客户 ${"面向企业服务的科技解决方案 ".repeat(8)}`);
  await editor.getByLabel("所属行业").fill("科技服务");
  await editor.getByLabel("联系人姓名").fill("张晓");
  await editor.getByLabel("联系电话").fill("138 0000 1234");
  await editor.getByLabel("电子邮箱").fill("contact@example.com");
  await expect(editor.locator(".array-item")).toHaveCount(0);
  for (const city of ["上海市", "杭州市"]) {
    await editor.getByRole("button", { name: "添加明细", exact: true }).click();
    await editor.locator(".array-item").last().getByLabel("城市").fill(city);
  }
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const row = preview.getByRole("row").filter({ hasText: "测试客户" });
  await expect(row.locator(".complex-summary")).toHaveText(["已配置 2 项", "共 2 项"]);
  await row.getByRole("button", { name: "查看基本资料详情", exact: true }).click();
  await expect(
    editor.getByRole("heading", { name: "基本资料详情", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(editor).toContainText("张晓");
  await expect(editor.locator("input, textarea, .complex-cell")).toHaveCount(0);
  await expect(editor).not.toContainText("上海市");
  await preview.locator("h1").filter({ hasText: "基本资料详情" }).press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(row.getByRole("button", { name: "查看基本资料详情", exact: true })).toBeFocused();
  await row.getByRole("button", { name: "查看联系地址详情", exact: true }).click();
  await expect(editor.locator(".array-item")).toHaveCount(2);
  await expect(editor).toContainText("上海市");
  await expect(editor).toContainText("杭州市");
  await expect(editor.getByRole("button", { name: /添加明细|删除明细|上移|下移/u })).toHaveCount(0);
  await editor.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await row.getByRole("button", { name: "详情", exact: true }).click();
  const detail = preview.locator(".record-detail");
  await expect(detail).toContainText("科技服务");
  await expect(detail).toContainText("张晓");
  await expect(detail.locator(".array-item")).toHaveCount(2);
  for (const card of [
    detail.locator('fieldset[data-field-path="/profile"]'),
    detail.locator('fieldset[data-field-path="/profile/contact"]'),
    detail.locator('fieldset[data-field-path="/addresses"]'),
  ]) {
    await expect(card).toHaveCSS("border-top-style", "dashed");
    await expect(card).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(card.locator(":scope > legend")).toBeVisible();
  }
  await expect(detail.locator('fieldset[data-field-path="/profile"] > legend')).toHaveText(
    "基本资料",
  );
  await expect(detail.locator('fieldset[data-field-path="/profile/contact"] > legend')).toHaveText(
    "主要联系人",
  );
  await expect(detail.locator('fieldset[data-field-path="/addresses"] > legend')).toHaveText(
    "联系地址",
  );
  const alignment = await detail
    .locator('.form-item[data-field-path="/name"] > .detail-value')
    .evaluate((element) => {
      const area = element.getBoundingClientRect();
      const value = element.firstElementChild!.getBoundingClientRect();
      return {
        left: Math.abs(area.left - value.left),
        vertical: Math.abs(area.top + area.height / 2 - value.top - value.height / 2),
      };
    });
  expect(alignment.left).toBeLessThan(1);
  expect(alignment.vertical).toBeLessThan(1);
  const statusAlignment = await detail
    .locator('.form-item[data-field-path="/status"] > .detail-value')
    .evaluate((element) => {
      const area = element.getBoundingClientRect();
      const value = element.firstElementChild!.getBoundingClientRect();
      const item = element.parentElement!.getBoundingClientRect();
      return {
        vertical: Math.abs(area.top + area.height / 2 - value.top - value.height / 2),
        fillsBelowLabel: Math.abs(item.bottom - area.bottom),
        multilineHeight: area.height,
      };
    });
  expect(statusAlignment.vertical).toBeLessThan(1);
  expect(statusAlignment.fillsBelowLabel).toBeLessThan(1);
  expect(statusAlignment.multilineHeight).toBeGreaterThan(32);
  await preview.getByRole("button", { name: "返回列表", exact: true }).click();
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await editor.getByLabel("联系人姓名").fill("李明");
  await editor
    .locator(".array-item")
    .nth(1)
    .getByRole("button", { name: "上移", exact: true })
    .click();
  await expect(editor.locator(".array-item").first().getByLabel("城市")).toHaveValue("杭州市");
  await editor.locator(".array-item").first().getByLabel("城市").fill("苏州市");
  await editor
    .locator(".array-item")
    .nth(1)
    .getByRole("button", { name: "删除明细", exact: true })
    .click();
  await editor.getByRole("button", { name: "添加明细", exact: true }).click();
  await editor.locator(".array-item").nth(1).getByLabel("城市").fill("南京市");
  await editor.locator(".array-item").nth(1).getByLabel("详细地址").fill("示例路 9 号");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await row.getByRole("button", { name: "详情", exact: true }).click();
  await expect(detail).toContainText("李明");
  await expect(detail.locator(".array-item").first()).toContainText("苏州市");
  await expect(detail.locator(".array-item").nth(1)).toContainText("南京市");
  await expect(detail.locator(".array-item")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await detail.evaluate(
      (element) =>
        element.ownerDocument.documentElement.scrollWidth <=
        element.ownerDocument.defaultView!.innerWidth,
    ),
  ).toBe(true);
});

test("字段配置示例发布后驱动树形 layout、筛选、表格和编辑，移动端上下排列", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const definition: ModelDefinition = JSON.parse(
    await readFile("examples/catalog.definition.json", "utf8"),
  );
  await page.getByRole("button", { name: "新建模型", exact: true }).click();
  await page.getByLabel("新模型 ID", { exact: true }).fill(definition.document.id);
  await page.getByRole("button", { name: "创建模型", exact: true }).click();
  await expect(page).toHaveURL(/\/models\/catalog$/u);
  await fillJson(page, JSON.stringify(definition, null, 2));
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("校验通过");
  await page.getByRole("button", { name: "手动发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已手动发布版本 1");
  for (const record of [
    { id: "catalog-root", name: "知识库" },
    { id: "catalog-child", name: "技术文档", parentId: "catalog-root" },
    { id: "catalog-leaf", name: "API 手册", parentId: "catalog-child" },
    { id: "catalog-other", name: "产品文档", status: "停用" },
  ]) {
    const response = await request(page, "/records/catalog", "POST", record);
    expect(response.ok(), await response.text()).toBe(true);
  }
  await page.goto("/list/catalog");
  await page.getByRole("button", { name: "树形视图", exact: true }).click();
  await expect(page).toHaveURL(/\/tree-list\/catalog$/u);
  const tree = page.getByRole("complementary", { name: "目录层级" });
  await expect(tree.getByRole("button", { name: "知识库", exact: true })).toBeVisible();
  const table = page.getByRole("table", { name: "目录记录", exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(table.locator("thead th")).toHaveText(["目录名称", "状态", "操作"]);
  const filters = page.getByRole("form", { name: "筛选记录" });
  await expect(filters.getByPlaceholder("查询目录")).toBeVisible();
  await expect(filters.getByLabel("父级 ID")).toHaveCount(0);
  await expect(filters.getByLabel("说明", { exact: true })).toHaveCount(0);
  await tree.getByRole("button", { name: "知识库", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody")).toContainText("技术文档");
  await expect(table.locator("tbody")).not.toContainText("API 手册");
  await filters.getByPlaceholder("查询目录").fill("不存在");
  await filters.getByRole("button", { name: "查询", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(0);
  await filters.getByRole("button", { name: "清空筛选", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await table.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByPlaceholder("输入目录名称")).toHaveValue("技术文档");
  await editor.getByPlaceholder("输入目录名称").fill("开发指南");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page).toHaveURL(/\/tree-list\/catalog$/u);
  await expect(tree.getByRole("button", { name: "开发指南", exact: true })).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: join(tmpdir(), "alien-form-tree-list-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tree).toBeVisible();
  const placement = await page.locator(".tree-list-page").evaluate((element) => {
    const tree = element.querySelector(".tree-panel")!.getBoundingClientRect();
    const list = element.querySelector(".list-page")!.getBoundingClientRect();
    return {
      above: tree.bottom <= list.top,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(placement).toEqual({ above: true, overflow: false });
  await page.screenshot({
    path: join(tmpdir(), "alien-form-tree-list-mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("无效草稿、本地预览保存、手动发布、刷新与旧页 422 保留输入", async ({ page, context }) => {
  const source = await (await request(page, "/models/orders")).json();
  const definition = structuredClone(source.definition);
  definition.document.id = "review-orders";
  definition.document.title = "审阅订单";
  definition.backend.storage.table = "biz_review_orders";
  definition.backend.storage.bindings.forEach((binding: { id: string }) => {
    binding.id = binding.id.replace("orders:", "review-orders:");
  });
  await page.getByRole("button", { name: "新建模型", exact: true }).click();
  await page.getByLabel("新模型 ID", { exact: true }).fill("review-orders");
  await page.getByRole("button", { name: "创建模型", exact: true }).click();
  await expect(page).toHaveURL(/\/models\/review-orders$/u);
  const json = page.getByRole("textbox", { name: "完整 definition JSON" });
  await fillJson(
    page,
    JSON.stringify({ ...definition, document: { ...definition.document, data: {} } }, null, 2),
  );
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "草稿诊断" }).getByRole("alert").first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "手动发布", exact: true })).toBeDisabled();
  expect((await request(page, "/runtime/models/review-orders")).status()).toBe(404);
  await fillJson(page, JSON.stringify(definition, null, 2));
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("校验通过");
  const preview = page.frameLocator('iframe[title="模型管理预览"]');
  await expect(preview.getByRole("heading", { name: "审阅订单", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "新建记录", exact: true }).click();
  await preview.getByRole("dialog").getByLabel("订单号").fill("PREVIEW-ONLY");
  await preview.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(preview.getByRole("dialog")).toHaveCount(0);
  await expect(preview.locator("tbody")).toContainText("PREVIEW-ONLY");
  expect((await request(page, "/runtime/models/review-orders")).status()).toBe(404);
  await page.getByRole("button", { name: "手动发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已手动发布版本 1");
  expect(
    await (
      await request(page, "/records/review-orders/query", "POST", {
        filters: {},
        page: 1,
        pageSize: 10,
      })
    ).json(),
  ).toMatchObject({ list: [], total: 0 });
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
  await editor.locator(".record-form").getByLabel("订单号").fill("kept");
  const ordinary = await context.newPage();
  await login(ordinary, "/list/review-orders");
  await expect(ordinary.getByRole("heading", { name: "审阅订单", exact: true })).toBeVisible();
  definition.document.title = "新发布订单";
  definition.document.data.properties.orderNo.minLength = 8;
  await fillJson(page, JSON.stringify(definition, null, 2));
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
  await editor.locator(".record-form").getByRole("button", { name: "保存", exact: true }).click();
  expect((await response).status()).toBe(422);
  await expect(editor.locator(".record-form").getByLabel("订单号")).toHaveValue("kept");
  await expect(
    editor.locator("header.topbar").getByRole("heading", { name: "编辑审阅订单" }),
  ).toBeVisible();
  await expect(editor.locator(".server-issues")).toContainText("/orderNo");
  const version = page.getByRole("combobox", { name: "模型版本", exact: true });
  await expect(version).toContainText("最新 · v2");
  expect(
    await version.evaluate(
      (element) =>
        !!(
          element.compareDocumentPosition(
            [...document.querySelectorAll("header.topbar button")].find(
              (button) => button.textContent?.trim() === "重新载入",
            )!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
    ),
  ).toBe(true);
  definition.document.title = "切换保留最新草稿";
  await fillJson(page, JSON.stringify(definition, null, 2));
  await version.click();
  await page.getByRole("option", { name: "v1 · 已发布", exact: true }).click();
  await expect(page.locator("header.topbar").getByRole("heading")).toHaveText("审阅订单");
  await expect(json).toContainText("审阅订单");
  await expect(json).toHaveAttribute("aria-readonly", "true");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "手动发布", exact: true })).toBeDisabled();
  await expect(preview.getByRole("heading", { name: "审阅订单", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重新载入", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已重新载入发布版本 1");
  await expect(version).toContainText("v1 · 已发布");
  await version.click();
  await page.getByRole("option", { name: "最新 · v2", exact: true }).click();
  await expect(json).toContainText("切换保留最新草稿");
  await expect(json).toHaveAttribute("aria-readonly", "false");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
  await expect(
    preview.getByRole("heading", { name: "切换保留最新草稿", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新载入", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已重新载入最新管理状态");
  await expect(json).toContainText("新发布订单");
  await expect(preview.getByRole("heading", { name: "新发布订单", exact: true })).toBeVisible();
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
  await expect(json).toContainText("cas-model");
  const snapshot = await (await request(page, "/models/cas-model", "GET", undefined, agent)).json();
  await fillJson(
    page,
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
  await expect(json).toContainText("保留编辑文本");
  await page.getByRole("button", { name: "重新载入", exact: true }).click();
  await expect(json).toContainText("agent 最新草稿");
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

test("管理页 flex 间距统一、内容边缘对齐且桌面与移动无溢出", async ({ page }, info) => {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["medium", 960, 900],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/models/orders");
    await expect(page.getByRole("button", { name: "退出", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "完整 definition JSON" })).toBeVisible();
    await expect(page.locator("header.page-header")).toHaveCount(0);
    await expect(
      page.locator("header.topbar").getByRole("button", { name: "保存草稿" }),
    ).toBeVisible();
    if (width < 850) await expect(page.getByRole("separator")).not.toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="模型管理预览"]')
        .getByRole("heading", { name: "订单", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const assertAlignment = async () => {
      const layout = await page.evaluate(() => {
        const read = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector)!;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            x: rect.x,
            y: rect.y,
            right: rect.right,
            bottom: rect.bottom,
            display: style.display,
            gap: parseFloat(style.gap),
            padding: style.padding,
            margin: style.margin,
          };
        };
        return {
          shell: read(".app-shell"),
          sidebar: read(".sidebar"),
          main: read(".app-main"),
          topbar: read("header.topbar"),
          canvas: read("#main-content"),
        };
      });
      expect(layout.shell.display).toBe("flex");
      expect(layout.main.padding).toBe("0px");
      expect(layout.main.margin).toBe("0px");
      expect(layout.canvas.padding).toBe("0px");
      expect(layout.canvas.margin).toBe("0px");
      expect(layout.topbar.x).toBeCloseTo(layout.canvas.x);
      expect(layout.topbar.right).toBeCloseTo(layout.canvas.right);
      expect(layout.canvas.y - layout.topbar.bottom).toBeCloseTo(layout.shell.gap);
      if (width > 600) {
        expect(layout.main.x - layout.sidebar.right).toBeCloseTo(layout.shell.gap);
        expect(layout.main.y).toBeCloseTo(layout.sidebar.y);
        expect(layout.main.bottom).toBeCloseTo(layout.sidebar.bottom);
      } else {
        expect(layout.main.y - layout.sidebar.bottom).toBeCloseTo(layout.shell.gap);
        expect(layout.main.x).toBeCloseTo(layout.sidebar.x);
      }
    };
    await assertAlignment();
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
    for (const route of ["/models", "/tokens", "/list/orders"]) {
      await page.goto(route);
      await expect(page.locator("header.topbar h1")).toBeVisible();
      await expect(page.locator("#main-content > div").first()).toBeVisible();
      await assertAlignment();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});
