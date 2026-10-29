import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { errorPayload, FormworkError } from "formwork/model";
import type { Actor, Env } from "./contracts";
import { bootstrap } from "./seed";
import { ModelService, assertModelId } from "./application/model-service";
import { RecordService } from "./application/record-service";
import { registerCapabilities } from "./application/capabilities";
import { dispatchOutbox } from "./application/outbox";
import {
  authenticate,
  actorSummary,
  login,
  requireUser,
  requireBusiness,
  listCredentials,
  issueCredential,
} from "./application/auth/service";
import { ServiceError, forbidden, invalid, notFound } from "./http/errors";

type AppEnv = { Bindings: Env; Variables: { actor: Actor } };
const saveSchema = z
  .object({ definition: z.unknown(), ifRevision: z.string().min(1).nullable() })
  .strict();
const publishSchema = z.object({ ifRevision: z.string().min(1) }).strict();
const validateSchema = z
  .object({ definition: z.unknown(), router: z.string().optional() })
  .strict();

/** 创建唯一 Worker HTTP 应用，统一 Bearer 身份、DTO、CORS 和错误编码。 */
export function createApp() {
  const app = new Hono<AppEnv>();
  app.use(
    "/api/v1/*",
    bodyLimit({
      maxSize: 2 * 1024 * 1024,
      onError: (c) => c.json({ error: { code: "INVALID_INPUT", message: "请求超过 2 MiB" } }, 400),
    }),
  );
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    return cors({
      origin: (origin) =>
        c.env.FORMWORK_CLIENT_ORIGIN.split(",")
          .map((value) => value.trim())
          .includes(origin)
          ? origin
          : "",
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })(c, next);
  });
  app.use("/api/v1/*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (
      origin &&
      !c.env.FORMWORK_CLIENT_ORIGIN.split(",")
        .map((value) => value.trim())
        .includes(origin)
    )
      forbidden("客户端 Origin 未获允许");
    const length = Number(c.req.header("Content-Length") ?? 0);
    if (length > 2 * 1024 * 1024) invalid("请求超过 2 MiB");
    await bootstrap(c.env);
    await next();
  });
  app.get("/api/v1/health", async (c) => {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ ready: true, database: "D1" });
  });
  app.post("/api/v1/auth/login", async (c) => {
    const body = z
      .object({ username: z.string().min(1).max(128), password: z.string().min(1).max(1024) })
      .strict()
      .parse(await c.req.json());
    return c.json(await login(c.env.DB, body.username, body.password));
  });
  app.use("/api/v1/*", async (c, next) => {
    const actor = await authenticate(c.env.DB, c.req.header("Authorization"));
    c.set("actor", actor);
    if (!c.req.path.startsWith("/api/v1/formwork/capabilities/")) requireBusiness(actor);
    await next();
  });
  app.get("/api/v1/auth/me", (c) => c.json(actorSummary(c.get("actor"))));
  app.post("/api/v1/auth/logout", async (c) => {
    requireUser(c.get("actor"));
    await c.env.DB.prepare("UPDATE fw_credentials SET revoked_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), c.get("actor").credentialId)
      .run();
    return c.json({ loggedOut: true });
  });
  app.get("/api/v1/auth/tokens", async (c) =>
    c.json(await listCredentials(c.env.DB, c.get("actor"))),
  );
  app.post("/api/v1/auth/tokens", async (c) => {
    const actor = c.get("actor");
    requireUser(actor);
    const body = z
      .object({
        label: z.string().trim().min(1).max(128),
        kind: z.enum(["agent", "deploy"]).default("agent"),
        expiresInDays: z.number().int().min(1).max(365),
      })
      .strict()
      .parse(await c.req.json());
    if (body.kind === "deploy" && !actor.super) forbidden("只有超级管理员可签发 deploy credential");
    return c.json(
      await issueCredential(c.env.DB, actor.id, body.kind, body.label, body.expiresInDays),
      201,
    );
  });
  app.delete("/api/v1/auth/tokens/:id", async (c) => {
    const actor = c.get("actor");
    requireUser(actor);
    const result = await c.env.DB.prepare(
      "UPDATE fw_credentials SET revoked_at = ? WHERE id = ? AND user_id = ?",
    )
      .bind(new Date().toISOString(), c.req.param("id"), actor.id)
      .run();
    if (!result.meta.changes) notFound("credential 不存在");
    return c.json({ revoked: true });
  });
  const models = (c: Context<AppEnv>) => new ModelService(c.env.DB, c.get("actor"));
  app.get("/api/v1/models", async (c) => c.json(await models(c).list()));
  app.get("/api/v1/models/:modelId", async (c) =>
    c.json(await models(c).read(c.req.param("modelId"))),
  );
  app.put("/api/v1/models/:modelId/draft", async (c) => {
    const body = saveSchema.parse(await c.req.json());
    return c.json(await models(c).save(c.req.param("modelId"), body.definition, body.ifRevision));
  });
  app.post("/api/v1/models/:modelId/validate", async (c) => {
    const body = validateSchema.parse(await c.req.json());
    return c.json(await models(c).validate(c.req.param("modelId"), body.definition, body.router));
  });
  app.post("/api/v1/models/:modelId/publish", async (c) => {
    const body = publishSchema.parse(await c.req.json());
    return c.json(await models(c).publish(c.req.param("modelId"), body.ifRevision));
  });
  app.get("/api/v1/models/:modelId/versions", async (c) =>
    c.json(await models(c).versions(c.req.param("modelId"))),
  );
  app.get("/api/v1/models/:modelId/versions/:version", async (c) => {
    const version = z.coerce.number().int().positive().parse(c.req.param("version"));
    const snapshot = (await models(c).versions(c.req.param("modelId"))).find(
      (value) => value.version === version,
    );
    if (!snapshot) notFound("发布版本不存在");
    return c.json(snapshot);
  });
  app.get("/api/v1/models/:modelId/preview", async (c) => {
    const router = z.string().min(1).parse(c.req.query("router"));
    let params: Record<string, string> = {};
    if (c.req.query("params")) {
      try {
        params = z.record(z.string(), z.string()).parse(JSON.parse(c.req.query("params")!));
      } catch {
        invalid("params 必须是字符串对象 JSON");
      }
    }
    return c.json(
      await models(c).preview(c.req.param("modelId"), router, params, c.req.query("revision")),
    );
  });
  app.get("/api/v1/models/:modelId/draft-schema", async (c) =>
    c.json(
      await models(c).draftSchema(
        c.req.param("modelId"),
        z.string().min(1).parse(c.req.query("revision")),
      ),
    ),
  );
  app.get("/api/v1/runtime/models/:modelId/schema", async (c) =>
    c.json(await models(c).runtime(c.req.param("modelId"))),
  );
  app.get("/api/v1/formwork/capabilities", async (c) =>
    c.json(
      await models(c).capabilities(
        z.string().min(1).parse(c.req.query("modelId")),
        z.string().min(1).parse(c.req.query("router")),
      ),
    ),
  );
  app.put("/api/v1/formwork/capabilities/:appId", async (c) => {
    if (c.get("actor").kind !== "deploy") forbidden("清单登记需要 deploy credential");
    return c.json(await registerCapabilities(c.env, c.req.param("appId"), await c.req.json()));
  });
  app.use("/api/v1/records/*", async (c, next) => {
    const id = c.req.path.split("/")[4];
    assertModelId(id ?? "");
    await next();
    if (c.res.ok && ["POST", "PUT", "DELETE"].includes(c.req.method))
      c.executionCtx.waitUntil(dispatchOutbox(c.env.DB));
  });
  const records = (c: Context<AppEnv>) => new RecordService(c.env.DB, c.get("actor"));
  app.post("/api/v1/records/:modelId/query", async (c) =>
    c.json(await records(c).query(c.req.param("modelId"), await c.req.json())),
  );
  app.post("/api/v1/records/:modelId/options", async (c) =>
    c.json(await records(c).options(c.req.param("modelId"), await c.req.json())),
  );
  app.post("/api/v1/records/:modelId/subtree", async (c) =>
    c.json(await records(c).subtree(c.req.param("modelId"), await c.req.json())),
  );
  app.post("/api/v1/records/:modelId/batch-delete", async (c) =>
    c.json(await records(c).batchDelete(c.req.param("modelId"), await c.req.json())),
  );
  app.post("/api/v1/records/:modelId/commands/:command", async (c) =>
    c.json(
      (await records(c).command(
        c.req.param("modelId"),
        c.req.param("command"),
        await c.req.json(),
      )) as never,
    ),
  );
  app.post("/api/v1/records/:modelId", async (c) =>
    c.json(await records(c).create(c.req.param("modelId"), await c.req.json()), 201),
  );
  app.get("/api/v1/records/:modelId/:id", async (c) =>
    c.json(await records(c).read(c.req.param("modelId"), c.req.param("id"))),
  );
  app.put("/api/v1/records/:modelId/:id", async (c) =>
    c.json(await records(c).update(c.req.param("modelId"), c.req.param("id"), await c.req.json())),
  );
  app.delete("/api/v1/records/:modelId/:id", async (c) =>
    c.json(await records(c).delete(c.req.param("modelId"), c.req.param("id"))),
  );
  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "接口不存在" } }, 404));
  app.onError((error, c) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return c.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "请求参数无效",
            ...(error instanceof z.ZodError
              ? {
                  issues: error.issues.map((issue) => ({
                    path: `/${issue.path.join("/")}`,
                    code: "INVALID_INPUT",
                    message: issue.message,
                  })),
                }
              : {}),
          },
        },
        400,
      );
    if (error instanceof ServiceError)
      return c.json({ error: errorPayload(error) }, error.status as 400);
    if (error instanceof FormworkError)
      return c.json({ error: errorPayload(error) }, error.code === "FORBIDDEN" ? 403 : 400);
    console.error("Worker request failed", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "服务处理请求失败" } }, 500);
  });
  return app;
}
