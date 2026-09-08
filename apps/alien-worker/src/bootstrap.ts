import { parseModelSchema, type ModelSchema } from "@alien-form/protocol";
import {
  SYS_ADMIN_DEFAULT_PASSWORD,
  SYS_ADMIN_ID,
  SYS_ADMIN_NICKNAME,
  SYS_ADMIN_USERNAME,
} from "./domain/schemas/_sys_user.ts";
import { hashPassword } from "./services/auth/password.ts";
import type { Container } from "./container.ts";

function comparable(schema: ModelSchema): string {
  return JSON.stringify({ ...parseModelSchema(schema), version: 0 });
}

export async function ensureBootstrapped(container: Container): Promise<void> {
  for (const [, registration] of container.models.entries()) {
    if (!registration.schema) continue;
    const current = await container.modelStore.get(registration.schema.name);
    if (!current) {
      await container.modelService.create({ ...registration.schema, version: 0 });
      continue;
    }
    if (comparable(current) !== comparable(registration.schema)) {
      await container.modelService.update(current.name, {
        ...registration.schema,
        version: current.version,
      });
    }
  }
  await ensureSysAdmin(container);
}

async function ensureSysAdmin(container: Container): Promise<void> {
  const schema = await container.modelStore.get("_sys_user");
  if (!schema) throw new Error("内置用户模型未发布");
  const existing =
    (await container.recordStore.get(schema, SYS_ADMIN_ID)) ??
    (await container.recordStore.findByField(schema, "username", SYS_ADMIN_USERNAME));
  if (existing) return;
  await container.recordService.create(
    schema.name,
    {
      id: SYS_ADMIN_ID,
      username: SYS_ADMIN_USERNAME,
      nickname: SYS_ADMIN_NICKNAME,
      passwordHash: await hashPassword(SYS_ADMIN_DEFAULT_PASSWORD),
      createBy: SYS_ADMIN_ID,
      super: true,
      remark: "系统内置管理员（首次启动自动创建）。",
    },
    SYS_ADMIN_ID,
  );
}
