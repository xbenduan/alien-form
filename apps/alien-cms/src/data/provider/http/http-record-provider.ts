import type { RecordProvider } from "../record-provider";
import type {
  RecordListParams,
  RecordListResult,
  RecordDetailParams,
  RecordDetailResult,
  RecordCreateParams,
  RecordCreateResult,
  RecordUpdateParams,
  RecordUpdateResult,
  RecordDeleteParams,
  RecordDeleteResult,
  RecordBatchDeleteParams,
  RecordBatchDeleteResult,
} from "../../types/record";
import type { HttpClient } from "./http-client";

export class HttpRecordProvider implements RecordProvider {
  private readonly client: HttpClient;
  private readonly endpoint: string;

  constructor(
    client: HttpClient,
    endpoint?: string,
  ) {
    this.client = client;
    this.endpoint = endpoint ?? "/api/records";
  }

  async list(params: RecordListParams): Promise<RecordListResult> {
    const queryParams = this.client.buildListParams({
      pagination: params.pagination,
      sorter: params.sorter,
      filters: params.filters,
    });

    queryParams.model = params.model;

    const response = await this.client.request<any>(this.endpoint, { params: queryParams });
    return this.client.extractList(response);
  }

  async detail(params: RecordDetailParams): Promise<RecordDetailResult> {
    const response = await this.client.request<any>(`${this.endpoint}/${params.id}`, {
      params: { model: params.model },
    });
    return this.client.extractDetail(response);
  }

  async create(params: RecordCreateParams): Promise<RecordCreateResult> {
    const response = await this.client.request<any>(this.endpoint, {
      method: "POST",
      body: { model: params.model, values: params.values },
    });
    return response?.data ?? { success: true, data: response };
  }

  async update(params: RecordUpdateParams): Promise<RecordUpdateResult> {
    const response = await this.client.request<any>(`${this.endpoint}/${params.id}`, {
      method: "PUT",
      body: { model: params.model, values: params.values },
    });
    return response?.data ?? { success: true, data: response };
  }

  async delete(params: RecordDeleteParams): Promise<RecordDeleteResult> {
    await this.client.request<any>(`${this.endpoint}/${params.id}`, {
      method: "DELETE",
      params: { model: params.model },
    });
    return { success: true };
  }

  async batchDelete(params: RecordBatchDeleteParams): Promise<RecordBatchDeleteResult> {
    const response = await this.client.request<any>(`${this.endpoint}/batch-delete`, {
      method: "POST",
      body: { model: params.model, ids: params.ids },
    });
    return response?.data ?? { success: true, data: { deleted: params.ids.length } };
  }
}
