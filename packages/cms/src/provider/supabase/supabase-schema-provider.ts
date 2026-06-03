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
import type { SupabaseProvider } from "./supabase-client";

function toSummary(row: any): ModelSummary {
  return {
    name: row.model_name,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    source: row.source === "static-override" ? "static" : (row.source ?? "remote"),
    fieldCount: row.schema?.properties ? Object.keys(row.schema.properties).length : undefined,
    updatedAt: row.updated_at,
  };
}

export class SupabaseSchemaProvider implements SchemaProvider {
  private readonly provider: SupabaseProvider;
  private readonly client: any;
  private readonly table: string;

  constructor(provider: SupabaseProvider) {
    this.provider = provider;
    this.client = provider.client;
    this.table = provider.tables.schemas;
  }

  async list(params?: SchemaListParams): Promise<SchemaListResult> {
    let query = this.client
      .from(this.table)
      .select("model_name, title, subtitle, description, source, schema, updated_at", { count: "exact" })
      .eq("deleted", false);

    if (params?.keyword) {
      query = query.or(
        `title.ilike.%${params.keyword}%,model_name.ilike.%${params.keyword}%,description.ilike.%${params.keyword}%`
      );
    }

    query = query.order("updated_at", { ascending: false });

    if (params?.pagination) {
      const { current, pageSize } = params.pagination;
      const start = (current - 1) * pageSize;
      const end = start + pageSize - 1;
      query = query.range(start, end);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return {
      list: (data ?? []).map(toSummary),
      total: count ?? 0,
    };
  }

  async detail(params: SchemaDetailParams): Promise<SchemaDetailResult> {
    const { data, error } = await this.client
      .from(this.table)
      .select("schema, deleted")
      .eq("model_name", params.modelName)
      .single();

    if (error) throw new Error(error.message);
    if (!data || data.deleted) {
      throw new Error(`Schema not found: ${params.modelName}`);
    }

    return data.schema as CmsModelSchema;
  }

  async create(params: SchemaCreateParams): Promise<SchemaCreateResult> {
    const schema = params.schema;
    const modelName = schema["x-model"]?.name ?? "unknown";

    const { error } = await this.client.from(this.table).insert({
      model_name: modelName,
      title: schema["x-model"]?.title ?? schema.title ?? modelName,
      subtitle: schema["x-model"]?.subtitle ?? null,
      description: schema["x-model"]?.description ?? schema.description ?? null,
      schema,
      source: "runtime",
      deleted: false,
    });

    if (error) throw new Error(error.message);

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

    const { error } = await this.client
      .from(this.table)
      .update({
        title: schema["x-model"]?.title ?? schema.title ?? modelName,
        subtitle: schema["x-model"]?.subtitle ?? null,
        description: schema["x-model"]?.description ?? schema.description ?? null,
        schema,
        deleted: false,
        updated_at: new Date().toISOString(),
      })
      .eq("model_name", modelName);

    if (error) throw new Error(error.message);

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
    const { error } = await this.client
      .from(this.table)
      .update({ deleted: true, updated_at: new Date().toISOString() })
      .eq("model_name", params.modelName);

    if (error) throw new Error(error.message);

    return { success: true };
  }

  async exists(modelName: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(this.table)
      .select("model_name")
      .eq("model_name", modelName)
      .eq("deleted", false)
      .maybeSingle();

    if (error) return false;
    return Boolean(data);
  }
}
