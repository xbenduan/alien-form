import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelDefinition } from "formwork/model";

async function login(page: Page, destination = "/models") {
  const credentials = JSON.parse(
    await readFile(join(process.env.FORMWORK_E2E_ROOT!, "login.json"), "utf8"),
  );
  await page.goto(destination);
  await expect(page.getByRole("heading", { name: "登录 ALIEN CMS" })).toBeVisible();
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
test.beforeEach(async ({ page }) => {
  await login(page);
});

test("共享 Domain 新建与编辑排除数据只读字段，服务端保留默认值", async ({ page }) => {
  const modelId = `readonly-${Date.now()}`;
  const definition: ModelDefinition = {
    schemaVersion: 1,
    id: modelId,
    domain: "cms",
    title: "只读提交回归",
    data: {
      title: { type: "string", title: "标题", minLength: 1, required: true },
      content: { type: "string", format: "richtext", title: "正文" },
      readonlyText: { type: "string", title: "只读字段", readOnly: true, default: "服务端默认值" },
      readonlyObject: { $ref: "#/$defs/locked", title: "只读对象" },
      scores: { type: "array", format: "numbers", title: "分数", enum: [0, 2], default: [0, 2] },
      flags: { type: "array", format: "booleans", title: "标记", default: [false, true] },
      note: { type: "string", title: "备注", default: "待清空" },
    },
    $defs: {
      locked: {
        type: "object",
        readOnly: true,
        default: { label: "服务端对象" },
        properties: { label: { type: "string" } },
      },
    },
  };
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
      scores: [0, 2],
      flags: [false, true],
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
    await expect(row.getByText("否", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "查看只读对象详情", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("服务端对象");
    await page.keyboard.press("Escape");
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    await editor.getByLabel("标题").fill("  只读编辑  ");
    await editor
      .locator(".form-item")
      .filter({ has: page.getByLabel("备注", { exact: true }) })
      .getByRole("button", { name: "删除字段值" })
      .click();
    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" && response.url().includes(`/records/${modelId}/`),
    );
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    const updatedResponse = await updateResponse;
    expect(updatedResponse.ok()).toBe(true);
    expect(updatedResponse.request().postDataJSON().set).not.toHaveProperty("readonlyText");
    expect(updatedResponse.request().postDataJSON().set).not.toHaveProperty("readonlyObject");
    expect(updatedResponse.request().postDataJSON().unset).toContain("/note");
    const updated = await updatedResponse.json();
    expect(updated).not.toHaveProperty("note");
    expect(updated).toMatchObject({
      title: "只读编辑",
      readonlyText: "服务端默认值",
      readonlyObject: { label: "服务端对象" },
    });
  } finally {
    await request(page, `/models/${modelId}`, "DELETE");
  }
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
    await expect(page.getByRole("heading", { name: "登录 ALIEN CMS" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "登录 ALIEN CMS", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("formwork-user-session"))).toBeNull();
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "用户管理" }),
  ).toHaveCount(0);
});
