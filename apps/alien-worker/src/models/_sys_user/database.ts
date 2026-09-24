import { hashPassword } from "../../application/auth/password.ts";
import type { ModelDatabaseContext } from "@alien-form/alienbase";

/** Creates the initial super administrator account. */
export async function initialize(
  context: ModelDatabaseContext,
  constants: {
    readonly code: string;
    readonly adminId: string;
    readonly adminUsername: string;
    readonly adminDefaultPassword: string;
  },
  superAdminRoleId: string,
): Promise<void> {
  const model = await context.models.get(constants.code);
  if (!model) throw new Error("内置用户模型未发布");
  const existing =
    (await context.records.get(model, constants.adminId)) ??
    (await context.records.findByField(model, "username", constants.adminUsername));
  if (existing) {
    if (
      !Array.isArray(existing.roleId) ||
      existing.roleId.length !== 1 ||
      existing.roleId[0] !== superAdminRoleId ||
      existing.super !== true
    ) {
      await context.update(
        model.schema.name,
        existing.id,
        { roleId: [superAdminRoleId] },
        constants.adminId,
      );
    }
    return;
  }
  await context.create(
    model.schema.name,
    {
      id: constants.adminId,
      username: constants.adminUsername,
      passwordHash: await hashPassword(constants.adminDefaultPassword),
      roleId: [superAdminRoleId],
      createBy: constants.adminId,
      super: true,
      remark: "系统内置管理员（首次启动自动创建）。",
    },
    constants.adminId,
  );
}
