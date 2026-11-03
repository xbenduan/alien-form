import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelDefinition, QueryClause } from "formwork/model";

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

async function publishFilterModel(page: Page, modelId: string) {
  const definition: ModelDefinition = {
    schemaVersion: 1,
    id: modelId,
    title: "筛选交互回归",
    data: {
      title: { type: "string", title: "标题", required: true },
      amount: { type: "number", title: "金额", storage: { column: "amount" } },
      score: { type: "integer", title: "分数", enum: [-5, 0, 10] },
      paid: { type: "boolean", title: "已支付" },
      note: { type: "string", title: "备注", nullable: true },
      hidden: { type: "string", title: "隐藏字段", ui: { filter: false } },
      blocked: { type: "string", title: "不可筛选字段", query: { filter: false } },
    },
  };
  const draft = await request(page, `/models/${modelId}/draft`, "PUT", {
    definition,
    ifRevision: null,
  });
  expect(draft.ok()).toBe(true);
  const saved = await draft.json();
  expect(saved.diagnostics.errors).toEqual([]);
  const published = await request(page, `/models/${modelId}/publish`, "POST", {
    ifRevision: saved.revision,
  });
  expect(published.ok()).toBe(true);
}

async function chooseFilter(page: Page, index: number, part: "字段" | "运算符", value: string) {
  await page.getByRole("combobox", { name: `条件 ${index} ${part}`, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}

test("动态筛选独立组合、提交与重置，保留数值和空值语义", async ({ page }, testInfo) => {
  const modelId = `filters-${Date.now()}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await publishFilterModel(page, modelId);
    for (const record of [
      { title: "苹果零", amount: 0, score: 0, paid: false, note: null },
      { title: "苹果十", amount: 10, score: 10, paid: true, note: "已处理" },
      { title: "香蕉负", amount: -5, score: -5, paid: false },
      { title: "未填写" },
    ]) {
      expect((await request(page, `/records/${modelId}`, "POST", record)).ok()).toBe(true);
    }
    await page.goto(`/list/${modelId}`);
    const form = page.getByRole("form", { name: "筛选记录" });
    const rows = form.getByRole("group");
    const add = form.getByRole("button", { name: "添加条件", exact: true });
    const total = (count: number) =>
      expect(page.locator(".table-footer")).toContainText(`共 ${count} 条`);
    const submit = async (clauses: QueryClause[], count: number) => {
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/records/${modelId}/query`) &&
          response.request().method() === "POST",
      );
      await form.getByRole("button", { name: "查询", exact: true }).click();
      const result = await response;
      expect(result.ok()).toBe(true);
      expect(result.request().postDataJSON()).toMatchObject({ clauses, page: 1 });
      expect((await result.json()).total).toBe(count);
      await total(count);
    };
    const reset = async () => {
      await form.getByRole("button", { name: "重置", exact: true }).click();
      await expect(rows).toHaveCount(1);
      await total(4);
    };

    await expect(rows).toHaveCount(1);
    await expect(add).toHaveText("");
    await expect(add.locator("svg")).toHaveCount(1);
    await expect(form.getByRole("checkbox")).toHaveCount(0);
    await submit([], 4);
    await page.getByRole("combobox", { name: "条件 1 字段", exact: true }).click();
    await expect(page.getByRole("option", { name: "隐藏字段", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "不可筛选字段", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: "标题", exact: true }).click();
    await form.getByLabel("标题筛选值", { exact: true }).fill("苹果");
    await total(4);
    await submit([{ field: "/title", operator: "contains", operand: "苹果" }], 2);

    await add.click();
    await expect(page.getByRole("combobox", { name: "条件 2 字段" })).toBeFocused();
    await chooseFilter(page, 2, "字段", "金额");
    await chooseFilter(page, 2, "运算符", "大于等于");
    await rows.nth(1).getByLabel("金额筛选值").fill("0");
    await add.click();
    await chooseFilter(page, 3, "字段", "金额");
    await chooseFilter(page, 3, "运算符", "小于");
    await rows.nth(2).getByLabel("金额筛选值").fill("10");
    await submit(
      [
        { field: "/title", operator: "contains", operand: "苹果" },
        { field: "/amount", operator: "gte", operand: 0 },
        { field: "/amount", operator: "lt", operand: 10 },
      ],
      1,
    );
    await form.screenshot({ path: testInfo.outputPath("filters-desktop.png") });
    await form.getByRole("button", { name: "移除条件 2", exact: true }).click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1).getByLabel("金额筛选值")).toHaveValue("10");
    await expect(rows.nth(1).getByRole("combobox", { name: "条件 2 字段" })).toBeFocused();
    await submit(
      [
        { field: "/title", operator: "contains", operand: "苹果" },
        { field: "/amount", operator: "lt", operand: 10 },
      ],
      1,
    );

    for (const width of [768, 450, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      await expect(add).toBeVisible();
      await expect(form.getByRole("button", { name: "查询", exact: true })).toBeVisible();
    }
    await form.screenshot({ path: testInfo.outputPath("filters-mobile.png") });
    await reset();
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const [label, operator, count] of [
      ["大于", "gt", 1],
      ["大于等于", "gte", 2],
      ["小于", "lt", 1],
      ["小于等于", "lte", 2],
    ] as const) {
      await chooseFilter(page, 1, "字段", "金额");
      await chooseFilter(page, 1, "运算符", label);
      await form.getByLabel("金额筛选值").fill("0");
      await submit([{ field: "/amount", operator, operand: 0 }], count);
    }
    // JSON 存储字段与独立列使用相同的数值比较语义。
    await chooseFilter(page, 1, "字段", "分数");
    await chooseFilter(page, 1, "运算符", "大于等于");
    await form.getByLabel("分数筛选值").fill("0.5");
    await submit([{ field: "/score", operator: "gte", operand: 0.5 }], 1);

    await chooseFilter(page, 1, "字段", "已支付");
    await form.getByRole("combobox", { name: "已支付筛选值" }).click();
    await page.getByRole("option", { name: "否", exact: true }).click();
    await submit([{ field: "/paid", operator: "eq", operand: false }], 2);
    await chooseFilter(page, 1, "字段", "备注");
    await expect(form.getByLabel("备注筛选值")).toHaveValue("");
    await chooseFilter(page, 1, "运算符", "为空值");
    await expect(form.getByText("无需填写值", { exact: true })).toBeVisible();
    await submit([{ field: "/note", operator: "isNull" }], 1);
    await chooseFilter(page, 1, "运算符", "非空值");
    await submit([{ field: "/note", operator: "isNotNull" }], 1);

    await chooseFilter(page, 1, "字段", "金额");
    await chooseFilter(page, 1, "运算符", "范围");
    await form.getByLabel("范围起点").fill("10");
    await form.getByLabel("范围终点").fill("0");
    let queries = 0;
    const trackQuery = (request: import("@playwright/test").Request) => {
      if (request.url().endsWith(`/records/${modelId}/query`)) queries++;
    };
    page.on("request", trackQuery);
    await form.getByRole("button", { name: "查询", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText(["范围起点不能大于终点", "请检查筛选条件"]);
    expect(queries).toBe(0);
    page.off("request", trackQuery);
    await chooseFilter(page, 1, "运算符", "等于");
    await expect(form.getByLabel("金额筛选值")).toHaveValue("");
    await expect(form.getByRole("alert")).toHaveCount(0);
    await reset();
  } finally {
    await request(page, `/models/${modelId}`, "DELETE");
  }
});

test("模型预览使用相同动态条件和数值比较，不请求记录 API", async ({ page }) => {
  const modelId = `preview-filters-${Date.now()}`;
  try {
    await publishFilterModel(page, modelId);
    await page.goto(`/model-preview/${modelId}?version=1`);
    const recordRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/records/")) recordRequests.push(request.url());
    });
    for (const amount of [0, 10]) {
      await page.getByRole("button", { name: "新建记录", exact: true }).click();
      const editor = page.getByRole("dialog");
      await editor.getByLabel("标题 *", { exact: true }).fill(`预览 ${amount}`);
      await editor.getByLabel("金额", { exact: true }).fill(String(amount));
      await editor.getByRole("button", { name: "保存", exact: true }).click();
      await expect(editor).not.toBeVisible();
    }
    const form = page.getByRole("form", { name: "筛选记录" });
    await expect(form.getByRole("group")).toHaveCount(1);
    await chooseFilter(page, 1, "字段", "金额");
    await chooseFilter(page, 1, "运算符", "大于等于");
    await form.getByLabel("金额筛选值").fill("0");
    await form.getByRole("button", { name: "添加条件", exact: true }).click();
    await chooseFilter(page, 2, "字段", "金额");
    await chooseFilter(page, 2, "运算符", "小于");
    await form.getByRole("group").nth(1).getByLabel("金额筛选值").fill("10");
    await form.getByRole("button", { name: "查询", exact: true }).click();
    await expect(page.locator(".table-footer")).toContainText("共 1 条");
    await expect(page.locator("tbody")).toContainText("预览 0");
    await form.getByRole("button", { name: "重置", exact: true }).click();
    await expect(form.getByRole("group")).toHaveCount(1);
    await expect(page.locator(".table-footer")).toContainText("共 2 条");
    expect(recordRequests).toEqual([]);
  } finally {
    await request(page, `/models/${modelId}`, "DELETE");
  }
});
