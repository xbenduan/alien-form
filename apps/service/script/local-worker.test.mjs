import { mkdtemp, rm, writeFile, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { createFormworkApi } from "formwork/model";
import { compileDefinition } from "formwork/model";
import { createDefinitionTemplate } from "formwork/mcp";
import { startLocalWorker } from "./local-worker.mjs";
import { selectDevelopmentPort } from "../../../scripts/dev-ports.mjs";
import { synchronizeSystemModels } from "./initialize";

it("旧版 state 保留原样，新版用账号文件的同一凭证初始化独立数据库", async () => {
  const directory = await mkdtemp(join(tmpdir(), "alien-form-state-version-"));
  const options = {
    directory,
    port: await selectDevelopmentPort({
      preferred: 18789,
      strict: false,
      label: "state version test",
    }),
    clientOrigin: "http://localhost:5173",
    username: "retained-admin",
    password: randomBytes(24).toString("hex"),
    capabilityToken: randomBytes(32).toString("hex"),
  };
  let worker;
  try {
    worker = await startLocalWorker(options);
    const api = createFormworkApi({ url: `${worker.origin}/api/v1` });
    const before = await api.auth.login(options.username, options.password);
    // 复现旧库：账号和哈希正确，但没有字段存在标记与记录版本列。
    await worker.sql(
      "UPDATE sys_users SET data_content='{}'; ALTER TABLE sys_users DROP COLUMN _revision",
    );
    const activeState = worker.child.spawnargs[worker.child.spawnargs.indexOf("--persist-to") + 1];
    await worker.close();
    worker = undefined;
    const oldState = join(directory, "state");
    if (activeState !== oldState) await rename(activeState, oldState);
    const marker = join(oldState, "keep.txt");
    await writeFile(marker, "旧数据不删除、不转换");

    worker = await startLocalWorker(options);
    const after = await api.auth.login(options.username, options.password);
    expect(after.user.id).not.toBe(before.user.id);
    expect(after.user.username).toBe(options.username);
    expect(await readFile(marker, "utf8")).toBe("旧数据不删除、不转换");
    await worker.close();
    worker = undefined;

    worker = await startLocalWorker({ ...options, reset: true });
    await expect(api.auth.login(options.username, options.password)).resolves.toHaveProperty(
      "token",
    );
    expect(await readFile(marker, "utf8")).toBe("旧数据不删除、不转换");
  } finally {
    await worker?.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

it("普通重启保留数据和账号，系统更新幂等，显式重置清空数据库", async () => {
  const directory = await mkdtemp(join(tmpdir(), "alien-form-reset-"));
  const port = await selectDevelopmentPort({
    preferred: 18788,
    strict: false,
    label: "reset test",
  });
  const options = {
    directory,
    port,
    clientOrigin: "http://localhost:5173",
    username: "first-admin",
    password: randomBytes(24).toString("hex"),
    capabilityToken: randomBytes(32).toString("hex"),
  };
  let worker;
  try {
    worker = await startLocalWorker(options);
    const unauthenticated = createFormworkApi({ url: `${worker.origin}/api/v1` });
    const first = await unauthenticated.auth.login(options.username, options.password);
    const api = createFormworkApi({ url: `${worker.origin}/api/v1`, token: () => first.token });
    const system = await api.models.read("system-users");
    expect(system).toMatchObject({ canManage: false, canPublish: false });
    await expect(
      api.models.saveDraft("system-users", system.definition, {
        ifRevision: system.revision,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await api.models.list()).map((model) => model.id).sort()).toEqual([
      "system-model-categories",
      "system-roles",
      "system-users",
    ]);
    const sample = createDefinitionTemplate("orders");
    await api.models.saveDraft(sample.id, sample, { ifRevision: null });
    await worker.sql(
      "CREATE TABLE legacy_records(id TEXT PRIMARY KEY); INSERT INTO legacy_records VALUES ('history')",
    );
    const roles = await api.models.read("system-roles");
    const previousDefinition = compileDefinition(structuredClone(roles.definition));
    previousDefinition.document.title = "旧角色定义";
    previousDefinition.schema.title = "旧角色定义";
    delete previousDefinition.document.data.properties.canCreateModel;
    delete previousDefinition.schema.data.canCreateModel;
    previousDefinition.backend.storage.bindings =
      previousDefinition.backend.storage.bindings.filter(
        (binding) => binding.id !== "system-roles:canCreateModel",
      );
    const previousManifest = {
      table: "sys_roles",
      bindings: previousDefinition.backend.storage.bindings.map((binding) => ({
        ...binding,
        active: true,
      })),
      relations: previousDefinition.backend.relations.map((relation) => ({
        ...relation,
        active: true,
      })),
    };
    const sqlLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
    await worker.sql(
      `ALTER TABLE sys_roles DROP COLUMN canCreateModel;
       INSERT INTO fw_model_versions(model_id,version,definition_json,storage_manifest_json,publish_revision,published_by,published_at)
       SELECT 'system-roles',2,${sqlLiteral(JSON.stringify(previousDefinition))},${sqlLiteral(JSON.stringify(previousManifest))},
         'old-system-revision',record_id,'2026-01-01' FROM fw_system_identities WHERE name='bootstrap';
       UPDATE fw_models SET active_version=2 WHERE id='system-roles'`,
    );
    const query = async (sql) =>
      JSON.parse(await worker.sql(sql)).flatMap((result) => result.results);
    const apply = async (statements) => {
      await worker.sql(statements.join(";\n"));
    };
    await synchronizeSystemModels(query, apply);
    const updatedRoles = await api.models.read("system-roles");
    expect(updatedRoles).toMatchObject({ title: "角色管理", publishedVersion: 3 });
    expect(updatedRoles.definition).toEqual(roles.definition);
    expect((await api.models.version("system-roles", 2)).definition).toEqual(
      previousDefinition.schema,
    );
    expect(await query("SELECT code,name FROM sys_roles")).toEqual([
      { code: "super_admin", name: "超级管理员" },
    ]);
    const updatedColumns = await query("PRAGMA table_info(sys_roles)");
    expect(updatedColumns.some((column) => column.name === "canCreateModel")).toBe(true);
    await synchronizeSystemModels(query, () => {
      throw new Error("重复部署不应创建新版本");
    });
    expect((await api.models.read("system-roles")).revision).toBe(updatedRoles.revision);
    await writeFile(join(directory, "keep.txt"), "保留 state 外的文件");
    await worker.close();
    worker = undefined;
    worker = await startLocalWorker(options);
    expect((await api.models.read("orders")).definition.id).toBe("orders");
    expect((await api.auth.me()).username).toBe(options.username);
    await worker.close();
    worker = undefined;
    const secondOptions = {
      ...options,
      reset: true,
      username: "second-admin",
      password: randomBytes(24).toString("hex"),
      capabilityToken: randomBytes(32).toString("hex"),
    };
    worker = await startLocalWorker(secondOptions);
    await expect(
      unauthenticated.auth.login(options.username, options.password),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const second = await createFormworkApi({ url: `${worker.origin}/api/v1` }).auth.login(
      secondOptions.username,
      secondOptions.password,
    );
    const fresh = createFormworkApi({ url: `${worker.origin}/api/v1`, token: () => second.token });
    expect((await fresh.models.list()).map((model) => model.id).sort()).toEqual([
      "system-model-categories",
      "system-roles",
      "system-users",
    ]);
    const tables = JSON.parse(
      await worker.sql(
        "SELECT name FROM sqlite_schema WHERE type='table' AND (name='legacy_records' OR name='d1_migrations' OR name='fw_migration_runs')",
      ),
    );
    expect(tables[0].results).toEqual([]);
    expect(await readFile(join(directory, "keep.txt"), "utf8")).toBe("保留 state 外的文件");
  } finally {
    await worker?.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
