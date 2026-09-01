import { writeFileSync } from "node:fs";
import { sysUserSchema } from "../apps/alien-server/src/schemas/_sys_user.ts";

const json = JSON.stringify(sysUserSchema);
writeFileSync(new URL("./_sys_user.schema.json", import.meta.url), json);
console.log(json);
