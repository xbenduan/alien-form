import type { Container } from "../../../container.ts";
import { hashPassword } from "../../auth/password.ts";

/** Creates the initial super administrator account. */
export async function initialize(
  container: Container,
  constants: {
    readonly code: string;
    readonly adminId: string;
    readonly adminUsername: string;
    readonly adminDefaultPassword: string;
  },
  superAdminRoleId: string,
): Promise<void> {
  const schema = await container.modelStore.get(constants.code);
  if (!schema) throw new Error("内置用户模型未发布");
  const existing =
    (await container.recordStore.get(schema, constants.adminId)) ??
    (await container.recordStore.findByField(schema, "username", constants.adminUsername));
  if (existing) {
    if (
      !Array.isArray(existing.roleId) ||
      existing.roleId.length !== 1 ||
      existing.roleId[0] !== superAdminRoleId ||
      existing.super !== true
    ) {
      await container.recordService.update(
        schema.name,
        existing.id,
        { roleId: [superAdminRoleId] },
        constants.adminId,
      );
    }
    return;
  }
  await container.recordService.create(
    schema.name,
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
