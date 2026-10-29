/// <reference types="@cloudflare/workers-types" />
import worker from "../index";
import type { Env } from "../contracts";

// Test-only HTTP coordination preserves the workerd request's own I/O context.
export default {
  async fetch(
    request: Request,
    env: Env & { FORMWORK_TEST_GATE_URL: string },
    ctx: ExecutionContext,
  ) {
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
