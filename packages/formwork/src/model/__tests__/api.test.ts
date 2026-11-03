import { expect, it, vi } from "vitest";
import { createFormworkApi } from "../http";
import { assertRuntimeSchema, modelIssues } from "../schema";

const draft = {
  id: "orders",
  title: "未完成",
  stage: "draft",
  revision: "draft-2",
  publishedVersion: null,
  baseVersion: null,
  canManage: true,
  canPublish: false,
  definition: { id: "orders" },
  diagnostics: {
    errors: [{ path: "/data", code: "INVALID_MODEL", message: "缺少 data" }],
    runtimeChecks: [],
  },
};
it("带当前 Bearer 保存无效草稿并保留诊断，CAS 冲突暴露当前 revision", async () => {
  let token = "agent-one";
  const requests: Array<{ path: string; headers: Headers; body: unknown }> = [];
  const api = createFormworkApi({
    url: "https://worker.example/api/v1/",
    token: () => token,
    fetch: async (url, options) => {
      requests.push({
        path: String(url),
        headers: new Headers(options?.headers),
        body: JSON.parse(String(options?.body)),
      });
      return requests.length === 1
        ? Response.json(draft)
        : Response.json(
            {
              error: {
                code: "REVISION_CONFLICT",
                message: "草稿已修改",
                currentRevision: "draft-2",
              },
            },
            { status: 409 },
          );
    },
  });
  const saved = await api.models.saveDraft("orders", { id: "orders" }, { ifRevision: null });
  expect(saved.diagnostics.errors[0]?.path).toBe("/data");
  expect(requests[0]).toMatchObject({
    path: "https://worker.example/api/v1/models/orders/draft",
    body: { definition: { id: "orders" }, ifRevision: null },
  });
  expect(requests[0]!.headers.get("Authorization")).toBe("Bearer agent-one");
  token = "agent-two";
  await expect(
    api.models.saveDraft("orders", saved.definition, { ifRevision: "draft-1" }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT", currentRevision: "draft-2" });
  expect(requests).toHaveLength(2);
  expect(requests[1]!.headers.get("Authorization")).toBe("Bearer agent-two");
});

it("401 清理会话，已取消请求不触达网络", async () => {
  let calls = 0;
  let expired = 0;
  const api = createFormworkApi({
    url: "/api/v1",
    onUnauthorized: () => expired++,
    fetch: async () => {
      calls++;
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "会话失效" } },
        { status: 401 },
      );
    },
  });
  await expect(api.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(expired).toBe(1);
  await expect(api.auth.me({ signal: AbortSignal.abort() })).rejects.toMatchObject({
    code: "ABORTED",
  });
  expect(calls).toBe(1);
});

it("navigation 使用共享 Bearer 和可取消请求，校验快照与固定路由", async () => {
  const requests: Array<{ url: string; method?: string; signal?: AbortSignal | null }> = [];
  const snapshot = {
    systemModels: [{ id: "system-users", title: "用户管理" }],
    pinnedModels: [],
    pinnableModelIds: ["orders"],
  };
  let response: unknown = snapshot;
  const api = createFormworkApi({
    url: "https://worker.example/api/v1",
    token: () => "user-token",
    fetch: async (url, options) => {
      expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer user-token");
      requests.push({ url: String(url), method: options?.method, signal: options?.signal });
      return Response.json(response);
    },
  });
  const signal = new AbortController().signal;
  expect(await api.navigation.read({ signal })).toEqual(snapshot);
  await api.navigation.pinModel("orders");
  await api.navigation.unpinModel("orders");
  expect(requests).toEqual([
    { url: "https://worker.example/api/v1/navigation", method: "GET", signal },
    {
      url: "https://worker.example/api/v1/navigation/pins/orders",
      method: "PUT",
      signal: undefined,
    },
    {
      url: "https://worker.example/api/v1/navigation/pins/orders",
      method: "DELETE",
      signal: undefined,
    },
  ]);
  response = { ...snapshot, pinnedModels: [{ id: "bad/id", title: "无效" }] };
  await expect(api.navigation.read()).rejects.toThrow();
  await expect(api.navigation.pinModel("bad/id")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(api.navigation.read({ signal: AbortSignal.abort() })).rejects.toMatchObject({
    code: "ABORTED",
  });
  expect(requests).toHaveLength(4);
});

it("旧请求的 401 不清除新账号 token", async () => {
  let token = "old-user";
  let expired = 0;
  let respond!: (response: Response) => void;
  const api = createFormworkApi({
    url: "/api/v1",
    token: () => token,
    onUnauthorized: () => expired++,
    fetch: () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
  });
  const reading = api.navigation.read();
  token = "new-user";
  respond(
    Response.json({ error: { code: "UNAUTHORIZED", message: "旧会话失效" } }, { status: 401 }),
  );
  await expect(reading).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(expired).toBe(0);
});

it("RuntimeSchema 拒绝函数 props 和受控覆盖", () => {
  const handler = () => 1;
  const schema = {
    schemaVersion: 1,
    id: "orders",
    title: "订单",
    data: { title: { type: "string", props: { onClick: handler } } },
  };
  expect(() => assertRuntimeSchema(schema)).toThrow(/校验失败/u);
  expect(() =>
    assertRuntimeSchema({
      ...schema,
      data: { title: { type: "string", props: { value: "bad" } } },
    }),
  ).toThrow(/校验失败/u);
});

it("后端禁用 Function 构造器时仍校验协议，props 字符串不执行", () => {
  vi.stubGlobal("Function", () => {
    throw new Error("Worker 禁止动态代码");
  });
  try {
    const document = {
      schemaVersion: 1,
      id: "orders",
      title: "订单",
      data: { title: { type: "string", props: { placeholder: "{{ () => fn.save() }}" } } },
    };
    expect(modelIssues(document)).toEqual([]);
    document.data.title.props.placeholder = "{{ ( }}";
    expect(modelIssues(document)).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
  }
});
