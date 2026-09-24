import { AlienClient } from "@alien-form/sdk";

/** MDM 使用的共享 SDK 客户端；认证 token 与历史版本保持兼容。 */
export const sdkClient = new AlienClient({
  baseUrl: "",
  authStorageKey: "alien-mdm-token",
});
