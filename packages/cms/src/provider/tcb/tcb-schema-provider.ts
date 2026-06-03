import type { SchemaProvider } from "../schema-provider";
import type {
  SchemaListParams,
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

export class TcbSchemaProvider implements SchemaProvider {
  private readonly db: any;
  private readonly collection: string;

  constructor(private readonly client: TcbClient) {
    this.db = client.database();
    this.collection = client.collections.schemas;
  }

  async list(params?: SchemaListParams): Promise<SchemaListResult> {
    const _ = this.db.command;
    let query = this.db.collection(this.collection).where({ deleted: _.neq(true) });

    if (params?.keyword) {
      const regex = this.db.RegExp({ regexp: params.keyword, options: "i" });
      query = this.db.collection(this.collection).where(
        _.and([
          { deleted: _.neq(true) },
          _.or([{ title: regex }, { modelName: regex }, { description: regex }]),
        ])
      );
    }

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
