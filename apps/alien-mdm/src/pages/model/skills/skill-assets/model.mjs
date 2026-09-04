import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const connection = JSON.parse(
  await readFile(resolve(skillRoot, "references/connection.json"), "utf8"),
);
const [command, firstArg, secondArg] = process.argv.slice(2);
if (!["get", "create", "update"].includes(command)) {
  throw new Error(
    "用法: node scripts/model.mjs get <模型名> | create <模型 JSON> | update <模型名> <模型 JSON>",
  );
}

const headers = {
  Accept: "application/json",
};
if (connection.authentication.bearerToken) {
  headers.Authorization = `Bearer ${connection.authentication.bearerToken}`;
} else if (connection.authentication.cookie) {
  headers.Cookie = connection.authentication.cookie;
} else {
  throw new Error("Skill 中没有可用登录凭证，请重新登录并下载");
}

const modelUrl = (operation, name) =>
  connection.modelApi[operation].urlTemplate.replace("{name}", encodeURIComponent(name));

let url;
let method;
let requestBody;
if (command === "get") {
  if (!firstArg) throw new Error("get 命令需要模型名");
  url = modelUrl("get", firstArg);
  method = connection.modelApi.get.method;
} else if (command === "create") {
  if (!firstArg) throw new Error("create 命令需要模型 JSON 文件");
  url = connection.modelApi.create.url;
  method = connection.modelApi.create.method;
  headers["Content-Type"] = connection.modelApi.contentType;
  requestBody = await readFile(resolve(process.cwd(), firstArg), "utf8");
  JSON.parse(requestBody);
} else {
  if (!firstArg || !secondArg) throw new Error("update 命令需要模型名和模型 JSON 文件");
  url = modelUrl("update", firstArg);
  method = connection.modelApi.update.method;
  headers["Content-Type"] = connection.modelApi.contentType;
  requestBody = await readFile(resolve(process.cwd(), secondArg), "utf8");
  JSON.parse(requestBody);
}

const response = await fetch(url, {
  method,
  headers,
  body: requestBody,
});
const responseBody = await response.text();
if (!response.ok) {
  throw new Error(`模型 ${command} 失败 (${response.status}): ${responseBody}`);
}
process.stdout.write(`${responseBody}\n`);
