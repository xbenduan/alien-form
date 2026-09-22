import { defineService, type Runtime } from "@alien-form/engine";
import type {
  BatchDeleteRequest,
  ListRequest,
  ListResponse,
  ModelRecord,
  RecordValues,
  SubtreeRequest,
  SubtreeResponse,
} from "@app-types";
import { coalesceRequest } from "@runtime/request-coalescer";
import { transport } from "@runtime/transport";

export function registerRecordServices(runtime: Runtime): void {
  const pendingRecordLists = new Map<string, Promise<ListResponse>>();
  const pendingSubtrees = new Map<string, Promise<SubtreeResponse>>();
  const pendingRecordGets = new Map<string, Promise<ModelRecord>>();

  runtime.service(
    "records.list",
    defineService(
      (request: ListRequest) => {
        const body = JSON.stringify(request);
        return coalesceRequest(pendingRecordLists, body, () =>
          transport.send<ListResponse>("/api/v1/records/list", {
            method: "POST",
            body,
          }),
        );
      },
      { description: "查询记录列表" },
    ),
  );
  runtime.service(
    "records.subtree",
    defineService(
      (request: SubtreeRequest) => {
        const body = JSON.stringify(request);
        return coalesceRequest(pendingSubtrees, body, () =>
          transport.send<SubtreeResponse>("/api/v1/records/subtree", {
            method: "POST",
            body,
          }),
        );
      },
      { description: "查询树形记录" },
    ),
  );
  runtime.service(
    "records.get",
    defineService(
      ({ model, id }: { model: string; id: string }) => {
        const path = `/api/v1/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`;
        return coalesceRequest(pendingRecordGets, path, () => transport.send<ModelRecord>(path));
      },
      { description: "读取记录" },
    ),
  );
  runtime.service(
    "records.create",
    defineService(
      (modelCode: string, values: RecordValues) =>
        transport.send<ModelRecord>(`/api/v1/records/${encodeURIComponent(modelCode)}`, {
          method: "POST",
          body: JSON.stringify(values),
        }),
      { description: "创建记录" },
    ),
  );
  runtime.service(
    "records.update",
    defineService(
      (modelCode: string, id: string, values: RecordValues) =>
        transport.send<ModelRecord>(
          `/api/v1/records/${encodeURIComponent(modelCode)}/${encodeURIComponent(id)}`,
          {
            method: "PUT",
            body: JSON.stringify(values),
          },
        ),
      { description: "更新记录" },
    ),
  );
  runtime.service(
    "records.delete",
    defineService(
      ({ model, id }: { model: string; id: unknown }) =>
        transport.send<void>(
          `/api/v1/records/${encodeURIComponent(model)}/${encodeURIComponent(String(id))}`,
          { method: "DELETE" },
        ),
      { description: "删除记录" },
    ),
  );
  runtime.service(
    "records.batchDelete",
    defineService(
      ({ model, ids }: BatchDeleteRequest & { model: string }) =>
        transport.send<void>(`/api/v1/records/${encodeURIComponent(model)}/batch-delete`, {
          method: "POST",
          body: JSON.stringify({ ids }),
        }),
      { description: "批量删除记录" },
    ),
  );
  runtime.service(
    "record.add",
    defineService(
      (values: RecordValues, context: { modelCode: string }) =>
        transport.send<ModelRecord>(`/api/v1/records/${encodeURIComponent(context.modelCode)}`, {
          method: "POST",
          body: JSON.stringify(values),
        }),
      { description: "提交新增表单" },
    ),
  );
  runtime.service(
    "record.edit",
    defineService(
      (values: RecordValues, context: { modelCode: string; recordId?: string }) =>
        transport.send<ModelRecord>(
          `/api/v1/records/${encodeURIComponent(context.modelCode)}/${encodeURIComponent(context.recordId ?? "")}`,
          {
            method: "PUT",
            body: JSON.stringify(values),
          },
        ),
      { description: "提交编辑表单" },
    ),
  );
}
