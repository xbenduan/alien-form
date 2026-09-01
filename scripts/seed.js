// 种子脚本：写入默认系统管理员（账号 _sys_admin，密码 alien123456）。
//
// 说明：前后端（自部署 alien-server 与 Cloudflare alien-worker）都会在启动/首个
// 请求时自动写入该默认管理员，通常无需再跑本脚本。保留它用于：
//   1. HTTP 模式（node scripts/seed.js）—— 需后端已登录才能写记录，仅作补充；
//   2. SQL 模式（node scripts/seed.js --sql）—— 生成 scripts/seed.sql，供 D1 直灌。
//
// 用法：
//   node scripts/seed.js                 # 默认 http://localhost:8787
//   node scripts/seed.js --sql           # 生成 scripts/seed.sql
//
// 记录自带 id，接口/SQL 均按 id 幂等 upsert，可重复执行不产生重复数据。

const { pbkdf2Sync, randomBytes } = require("node:crypto");
const API_BASE = process.env.API_BASE ?? `http://localhost:${process.env.PORT ?? 8787}`;
const DEFAULT_PASSWORD = "alien123456";
const SYS_ADMIN_ID = "_sys_admin";

function hashPassword(password) {
  // 迭代数与运行端对齐：Cloudflare Workers 的 WebCrypto PBKDF2 上限为 100000。
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$100000$${salt}$${hash}`;
}

const users = [
  {
    id: SYS_ADMIN_ID,
    username: SYS_ADMIN_ID,
    nickname: "系统管理员",
    passwordHash: hashPassword(DEFAULT_PASSWORD),
    createBy: SYS_ADMIN_ID,
    remark: "系统内置管理员。",
  },
];

// 灌入顺序即依赖顺序。
const groups = [{ model: "_sys_user", records: users }];

async function ensureServerUp() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`健康检查返回 ${res.status}`);
  } catch (err) {
    console.error(`[seed] 无法连接后端 ${API_BASE}，请先启动服务（pnpm dev:server）。`);
    console.error(`[seed] 原因：${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function createRecord(model, record) {
  const res = await fetch(`${API_BASE}/api/records/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`POST /api/records/${model} (${record.id}) -> ${res.status} ${detail}`);
  }
}

async function main() {
  console.log(`[seed] 目标后端：${API_BASE}`);
  await ensureServerUp();

  for (const { model, records } of groups) {
    for (const record of records) {
      await createRecord(model, record);
      console.log(`[seed] ✓ ${model} ${record.id}`);
    }
  }

  const total = groups.reduce((sum, g) => sum + g.records.length, 0);
  console.log(`[seed] 完成，共写入 ${total} 条记录。`);
}

// ---------------------------------------------------------------------------
// SQL 生成模式（用于 Cloudflare D1 直灌）：
//   node scripts/seed.js --sql            # 输出到 scripts/seed.sql
//   node scripts/seed.js --sql out.sql    # 自定义输出路径
//
// 把每条记录拍成 records 表的一行——系统字段（id/model/created_at/updated_at）成列，
// 其余字段收进 data_content JSON，与 worker 存储格式一致。生成后执行：
//   wrangler d1 execute alien-mdm --remote --file scripts/seed.sql
// 记录用 (model,id) 做 upsert，可重复执行不产生重复数据。
// ---------------------------------------------------------------------------
function sqlQuote(text) {
  return `'${String(text).replaceAll("'", "''")}'`;
}

function generateSql() {
  const now = Date.now();
  const lines = [
    "-- 由 scripts/seed.js --sql 自动生成，请勿手改。",
    "-- 执行：wrangler d1 execute alien-mdm --remote --file scripts/seed.sql",
    "",
  ];
  let total = 0;
  for (const { model, records } of groups) {
    lines.push(`-- ${model}（${records.length} 条）`);
    for (const record of records) {
      const { id, createdAt: _c, updatedAt: _u, ...data } = record;
      const dataContent = JSON.stringify(data);
      lines.push(
        `INSERT INTO "records" (id, model, created_at, updated_at, data_content) VALUES ` +
          `(${sqlQuote(id)}, ${sqlQuote(model)}, ${now}, ${now}, ${sqlQuote(dataContent)}) ` +
          `ON CONFLICT(model, id) DO UPDATE SET updated_at = excluded.updated_at, data_content = excluded.data_content;`,
      );
      total += 1;
    }
    lines.push("");
  }

  const { writeFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const outArg = process.argv.find((arg, i) => i >= 3 && !arg.startsWith("--"));
  const outPath = resolve(__dirname, outArg ?? "seed.sql");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`[seed] 已生成 SQL：${outPath}（共 ${total} 条记录）`);
}

if (process.argv.includes("--sql")) {
  generateSql();
} else {
  main().catch((err) => {
    console.error(`[seed] 失败：${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
