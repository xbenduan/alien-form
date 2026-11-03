# 旧协议迁移

当前运行时只接受新作者协议。已发布旧快照返回 `MIGRATION_REQUIRED`；远端系统模型同步遇到旧发布定义或旧草稿时也停止。开发启动的清库流程不用于升级真实数据。

## 先转换作者定义

```sh
node --import tsx scripts/migrate-schema.ts \
  --input legacy-definitions.json \
  --output candidates.json
```

输入为一个或一组旧 `{document,backend}` 定义，输出为 `{definition,report}`。工具保留字段稳定 id、column / jsonKey、关系 through 和权限；不修改输入或数据库。输出文件已存在时拒绝覆盖。

处理 report.errors 后再使用候选：

- 把 views / pages 落实到 Page / Window 代码，再使用 `--layouts-migrated` 明确确认。
- scene props 同名不同值时，统一字段 props 或在组件代码中按 scene 处理。
- `{{ ... }}` 表达式迁入业务代码；RichText 继续保存普通字符串。
- 跨模型引用应把目标旧定义一并输入；默认 `/name` 不存在时，通过 `--relation-labels labels.json` 提供 `{"/源字段":"/目标展示字段"}`。不同模型需要不同映射时分别运行转换。
- `$ref`、新数组唯一约束和无法自动转换的值约束必须按诊断处理。

只转换 JSON 不会升级数据库。

## 从备份生成事务计划

先取得包含所有 metadata、业务表及 through 表的一致 SQLite 备份。D1 的 SQL 导出可在隔离 SQLite 中还原后读取；不要直接读取正在运行的 WAL 文件副本。

准备 `reviewed.json`，将已审阅候选放到 published 和 drafts，二者独立：

```json
{
  "layoutsMigrated": true,
  "published": { "模型ID": { "schemaVersion": 1, "id": "模型ID", "title": "示意", "data": {} } },
  "drafts": {}
}
```

上述只是容器形状，实际内容必须使用转换后保留所有字段和 backend 策略的候选。每个旧发布模型和旧草稿都需要对应项，包括系统模型；不要用当前代码的系统模板直接替换旧库定义。

```sh
node --import tsx apps/service/script/schema-upgrade.ts \
  --database backup.sqlite \
  --candidates reviewed.json \
  --output upgrade.json
```

输出 `{models,statements}`，每条 SQL 可审阅，文件权限为 0600。计划生成器仅以只读方式打开备份：

1. 校验新字段、format 和 default，以及关系值类型、目标唯一性和展示字段。
2. 要求原字段 id、路径、存储、索引、关系基数、权限和行为保持一致；改变这些内容应另做数据迁移。
3. 检查存量记录是否满足新值契约及引用完整性，拒绝不兼容值。
4. 为原 metadata、业务记录和 through 表添加整行 CAS 条件；在线状态变化后必须重新生成。
5. 追加新发布版本，原不可变版本原样保留；草稿单独更新，原始草稿完整归档到 `fw_schema_upgrade_backups`。更新 management revision，保留草稿原 base_version 并标记重新校验。

事务计划必须在隔离副本演练后再用于目标库。SQLite 使用显式事务执行；D1 使用**一次** `db.batch(plan.statements.map(sql => db.prepare(sql)))`，任一 CAS 失败会回滚整批。不可逐条或拆批执行，不能因为超过 D1 批次限制就绕过原子性。计划包含用于并发校验的原始数据，应按数据库备份权限保管。

此工具面向可在单个事务内处理的协议升级。大库、BLOB / NUL 物理值、需更改数据编码或存储的情况会需要独立迁移实现；不会自动降级到部分更新。工具不连接线上数据库、不提供远端自动执行入口。

升级后部署新服务、登记新的能力清单，重新校验草稿并检查 form / filter / table / detail。历史旧版本仍可在备份或 SQL 中审计；运行时不把旧版本静默转换成新协议。
