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
} from "../../types/schema";
import type { HttpClient } from "./http-client";

export class HttpSchemaProvider implements SchemaProvider {
  private readonly endpoint: string;

  constructor(
    private readonly client: HttpClient,
    endpoint?: string,
  ) {
    this.endpoint = endpoint ?? "/api/schemas";
  }

  async list(params?: SchemaListParams): Promise<SchemaListResult> {
    const queryParams = this.client.buildListParams({
      pagination: params?.pagination,
      keyword: params?.keyword,
    });

    const response = await this.client.request<any>(this.endpoint, { params: queryParams });
    return this.client.extractList(response);
  }

  async detail(params: SchemaDetailParams): Promise<SchemaDetailResult> {
    const response = await this.client.request<any>(`${this.endpoint}/${params.modelName}`);
    return this.client.extractDetail(response);
  }

  async create(params: SchemaCreateParams): Promise<SchemaCreateResult> {
    const response = await this.client.request<any>(this.endpoint, {
      method: "POST",
      body: { schema: params.schema },
    });
    return response?.data ?? { success: true, data: response };
  }

  async update(params: SchemaUpdateParams): Promise<SchemaUpdateResult> {
    const response = await this.client.request<any>(`${this.endpoint}/${params.modelName}`, {
      method: "PUT",
      body: { schema: params.schema },
    });
    return response?.data ?? { success: true, data: response };
  }

  async delete(params: SchemaDeleteParams): Promise<SchemaDeleteResult> {
    await this.client.request<any>(`${this.endpoint}/${params.modelName}`, {
      method: "DELETE",
    });
    return { success: true };
  }

  async exists(modelName: string): Promise<boolean> {
    try {
      await this.client.request<any>(`${this.endpoint}/${modelName}`);
      return true;
    } catch {
      return false;
    }
  }
}
