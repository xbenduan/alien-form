import type { SchemaProvider } from "../schema-provider";
import type {
  SchemaListParams,
  SchemaListFilters,
  SchemaListResult,
  SchemaDetailParams,
  SchemaDetailResult,
  SchemaCreateParams,
  SchemaCreateResult,
  SchemaUpdateParams,
  SchemaUpdateResult,
  SchemaDeleteParams,
  SchemaDeleteResult,
  ModelSummary,
  CmsModelSchema,
} from "../../types/schema";
import type { TcbClient } from "./tcb-client";

function toSummary(doc: any): ModelSummary {
  return {
    name: doc._id ?? doc.modelName,
    title: doc.title ?? doc._id,
    subtitle: doc.subtitle,
    description: doc.description,
    source: doc.source === "static-override" ? "static" : (doc.source ?? "remote"),
    fieldCount: doc.schema?.properties ? Object.keys(doc.schema.properties).length : undefined,
    updatedAt: doc.updatedAt,
  };
}

function buildListWhere(db: any, filters?: SchemaListFilters, keyword?: string) {
  const _ = db.command;
  const conditions: any[] = [{ deleted: _.neq(true) }];

  const pushRegexCondition = (field: string, value?: string) => {
    if (!value?.trim()) {
      return;
    }

    conditions.push({
      [field]: db.RegExp({
        regexp: value.trim(),
        options: "i",
      }),
    });
  };

  pushRegexCondition("modelName", filters?.name);
  pushRegexCondition("title", filters?.title);
  pushRegexCondition("description", filters?.description);
  pushRegexCondition("source", filters?.source);

  if (keyword?.trim()) {
    const regex = db.RegExp({ regexp: keyword.trim(), options: "i" });
    conditions.push(_.or([{ title: regex }, { modelName: regex }, { description: regex }]));
  }

  return conditions.length === 1 ? conditions[0] : _.and(conditions);
}

export class TcbSchemaProvider implements SchemaProvider {
  private readonly client: TcbClient;
  private readonly db: any;
  private readonly collection: string;

  constructor(client: TcbClient) {
    this.client = client;
    this.db = client.database();
    this.collection = client.collections.schemas;
  }

  async list(params?: SchemaListParams): Promise<SchemaListResult> {
    const query = this.db
      .collection(this.collection)
      .where(buildListWhere(this.db, params?.filters, params?.keyword));

    const countResult = await query.count();
    const total = countResult.total;

    const current = params?.pagination?.current ?? 1;
    const pageSize = (params?.pagination?.pageSize ?? total) || 1;
    const skip = (current - 1) * pageSize;

    const { data } = await query
      .orderBy("updatedAt", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    return {
      list: data.map(toSummary),
      total,
    };
  }

  async detail(params: SchemaDetailParams): Promise<SchemaDetailResult> {
    const { data } = await this.db
      .collection(this.collection)
      .doc(params.modelName)
      .get();

    const doc = data[0] ?? data;
    if (!doc || doc.deleted) {
      throw new Error(`Schema not found: ${params.modelName}`);
    }

    return doc.schema as CmsModelSchema;
  }

  async create(params: SchemaCreateParams): Promise<SchemaCreateResult> {
    const schema = params.schema;
    const modelName = schema["x-model"]?.name ?? "unknown";
    const now = new Date().toISOString();

    await this.db.collection(this.collection).add({
      _id: modelName,
      modelName,
      title: schema["x-model"]?.title ?? schema.title ?? modelName,
      subtitle: schema["x-model"]?.subtitle,
      description: schema["x-model"]?.description ?? schema.description,
      schema,
      source: "runtime",
      deleted: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      data: {
        name: modelName,
        title: schema["x-model"]?.title ?? modelName,
        source: "runtime",
      },
    };
  }

  async update(params: SchemaUpdateParams): Promise<SchemaUpdateResult> {
    const { modelName, schema } = params;
    const now = new Date().toISOString();

    await this.db.collection(this.collection).doc(modelName).update({
      title: schema["x-model"]?.title ?? schema.title ?? modelName,
      subtitle: schema["x-model"]?.subtitle,
      description: schema["x-model"]?.description ?? schema.description,
      schema,
      deleted: false,
      updatedAt: now,
    });

    return {
      success: true,
      data: {
        name: modelName,
        title: schema["x-model"]?.title ?? modelName,
        source: "remote",
      },
    };
  }

  async delete(params: SchemaDeleteParams): Promise<SchemaDeleteResult> {
    const now = new Date().toISOString();

    await this.db.collection(this.collection).doc(params.modelName).update({
      deleted: true,
      updatedAt: now,
    });

    return { success: true };
  }

  async exists(modelName: string): Promise<boolean> {
    const { data } = await this.db
      .collection(this.collection)
      .doc(modelName)
      .get();

    const doc = data[0] ?? data;
    return Boolean(doc && !doc.deleted);
  }
}
