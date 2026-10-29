import type { Diagnostic, JsonValue, ModelDefinition, ModelDocument } from "formwork/model";
import type { StorageManifest } from "../contracts";

/** 保存一次性旧协议输入；不在运行时提供旧模型兼容。 */
export type LegacyField = {
  id: string;
  key: string;
  type: string;
  title?: string;
  required?: boolean;
  private?: boolean;
  storage?: {
    type: string;
    column?: string;
    system?: boolean;
    unique?: boolean;
    index?: boolean;
    default?: JsonValue;
  };
  relation?: {
    kind: "many-to-one" | "many-to-many";
    target: string;
    through?: string;
    valueField?: string;
  };
  form: Record<string, JsonValue>;
};
/** 描述旧 D1 中可盘点的持久化模型定义。 */
export type LegacySchema = {
  name: string;
  title: string;
  version: number;
  creatorId?: string;
  fields: LegacyField[];
  definitions?: Record<string, Record<string, JsonValue>>;
  pages?: JsonValue[];
};
/** 保存 SQLite 表结构、实际记录和显式索引，用于副本数据核对。 */
export type LegacyTable = {
  name: string;
  columns: { name: string; type: string; notnull: number; pk: number; dflt_value: string | null }[];
  rows: Record<string, string | number | null>[];
  indexes: {
    name: string;
    sql: string | null;
    unique: number;
    origin: string;
    columns: string[];
  }[];
  foreignKeys: unknown[];
  triggers: string[];
};
/** 汇总旧 D1 和原文件服务；samples 永远作为未发布草稿。 */
export type MigrationInventory = {
  models: { schema: LegacySchema; table: string }[];
  tables: LegacyTable[];
  files: {
    document: ModelDocument;
    records: Record<string, JsonValue>[];
    published: boolean;
    creatorId?: string;
  }[];
  identities?: { bootstrap: string; superRole: string; categories: Record<string, string> };
};
/** 返回迁移 SQL 和保留数据的核对依据，不在日志中输出记录明文。 */
export type MigrationPlan = {
  digest: string;
  mappings: Record<string, string>;
  models: {
    definition: ModelDefinition;
    manifest: StorageManifest;
    stage: "draft" | "published";
    creatorId: string;
    legacyVersion: number | null;
  }[];
  tables: {
    source: string;
    target: string;
    count: number;
    digest: string;
    rows: LegacyTable["rows"];
  }[];
  statements: string[];
  errors: Diagnostic[];
  warnings: Diagnostic[];
};
