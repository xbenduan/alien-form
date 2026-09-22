import { transport } from "@runtime/transport";

const SKILL_NAME = "alien-form-model";
const BASE_URL_TOKEN = "__ALIEN_FORM_BASE_URL__";
const generatedAssets = import.meta.glob("./generated/alien-form-model/**/*", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function connection() {
  const token = transport.token;
  const cookie = document.cookie || null;
  return {
    baseUrl: window.location.origin,
    modelApi: {
      create: { method: "POST", path: "/api/v1/models" },
      get: { method: "GET", pathTemplate: "/api/v1/models/{name}" },
      update: { method: "PUT", pathTemplate: "/api/v1/models/{name}" },
      contentType: "application/json",
    },
    authentication: {
      type: token ? "bearer" : cookie ? "cookie" : "none",
      bearerToken: token,
      cookie,
    },
    security:
      "此文件包含当前登录会话凭证。禁止提交到版本库、日志或聊天记录；会话失效后请重新下载 Skill。",
  };
}

/** Packages deterministic generated assets with the current authenticated connection. */
export async function downloadModelSkill(): Promise<void> {
  const { strToU8, zipSync } = await import("fflate");
  const currentConnection = connection();
  const files: Record<string, Uint8Array> = {};

  for (const [sourcePath, source] of Object.entries(generatedAssets)) {
    const relativePath = sourcePath.split("/generated/alien-form-model/")[1];
    if (!relativePath) continue;
    files[`${SKILL_NAME}/${relativePath}`] = strToU8(
      source.replaceAll(BASE_URL_TOKEN, currentConnection.baseUrl),
    );
  }
  files[`${SKILL_NAME}/references/connection.json`] = strToU8(stringify(currentConnection));

  const archive = zipSync(files, { level: 6 });
  const data = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([data], { type: "application/zip" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${SKILL_NAME}.zip`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
