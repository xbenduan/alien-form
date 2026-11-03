/// <reference types="@cloudflare/workers-types" />
import worker from "../index";
import type { Env } from "../contracts";
import { isObject } from "formwork/model";

// Test-only HTTP coordination preserves the workerd request's own I/O context.
export default {
  async fetch(
    request: Request,
    env: Env & { FORMWORK_TEST_GATE_URL: string; FORMWORK_TEST_SQL_TOKEN: string },
    ctx: ExecutionContext,
  ) {
    if (new URL(request.url).pathname === "/__test/sql") {
      if (
        request.method !== "POST" ||
        request.headers.get("Authorization") !== `Bearer ${env.FORMWORK_TEST_SQL_TOKEN}`
      )
        return new Response("测试 SQL 未获授权", { status: 403 });
      const input: unknown = await request.json();
      if (
        !isObject(input) ||
        !Array.isArray(input.sql) ||
        !input.sql.every((sql) => typeof sql === "string")
      )
        return new Response("SQL 必须是语句数组", { status: 400 });
      return Response.json(await env.DB.batch(input.sql.map((sql) => env.DB.prepare(sql))));
    }
    const name = request.headers.get("x-test-gate");
    if (!name) return worker.fetch(request, env, ctx);
    let paused = false;
    const db = new Proxy(env.DB, {
      get(target, key) {
        if (key === "batch")
          return async (statements: D1PreparedStatement[]) => {
            if (!paused) {
              paused = true;
              await fetch(`${env.FORMWORK_TEST_GATE_URL}/${encodeURIComponent(name)}`);
            }
            return target.batch(statements);
          };
        const member = Reflect.get(target, key);
        return typeof member === "function" ? member.bind(target) : member;
      },
    });
    return worker.fetch(request, { ...env, DB: db }, ctx);
  },
};
