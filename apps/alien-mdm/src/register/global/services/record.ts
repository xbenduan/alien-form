import type { Runtime } from "@alien-form/engine";
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

  runtime.service("records.list", (request: ListRequest) => {
    const body = JSON.stringify(request);
    return coalesceRequest(pendingRecordLists, body, () =>
      transport.send<ListResponse>("/api/v1/records/list", {
        method: "POST",
        body,
      }),
    );
  });
  runtime.service("records.subtree", (request: SubtreeRequest) => {
    const body = JSON.stringify(request);
    return coalesceRequest(pendingSubtrees, body, () =>
      transport.send<SubtreeResponse>("/api/v1/records/subtree", {
        method: "POST",
        body,
      }),
    );
  });
  runtime.service("records.get", ({ model, id }: { model: string; id: string }) => {
    const path = `/api/v1/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`;
    return coalesceRequest(pendingRecordGets, path, () => transport.send<ModelRecord>(path));
  });
  runtime.service("records.create", (modelCode: string, values: RecordValues) =>
    transport.send<ModelRecord>(`/api/v1/records/${encodeURIComponent(modelCode)}`, {
      method: "POST",
      body: JSON.stringify(values),
    }),
  );
  runtime.service("records.update", (modelCode: string, id: string, values: RecordValues) =>
    transport.send<ModelRecord>(
      `/api/v1/records/${encodeURIComponent(modelCode)}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(values),
      },
    ),
  );
  runtime.service("records.delete", ({ model, id }: { model: string; id: unknown }) =>
    transport.send<void>(
      `/api/v1/records/${encodeURIComponent(model)}/${encodeURIComponent(String(id))}`,
      { method: "DELETE" },
    ),
  );
  runtime.service("records.batchDelete", ({ model, ids }: BatchDeleteRequest & { model: string }) =>
    transport.send<void>(`/api/v1/records/${encodeURIComponent(model)}/batch-delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  );
  runtime.service("record.add", (values: RecordValues, context: { modelCode: string }) =>
    transport.send<ModelRecord>(`/api/v1/records/${encodeURIComponent(context.modelCode)}`, {
      method: "POST",
      body: JSON.stringify(values),
    }),
  );
  runtime.service(
    "record.edit",
    (values: RecordValues, context: { modelCode: string; recordId?: string }) =>
      transport.send<ModelRecord>(
        `/api/v1/records/${encodeURIComponent(context.modelCode)}/${encodeURIComponent(context.recordId ?? "")}`,
        {
          method: "PUT",
          body: JSON.stringify(values),
        },
      ),
  );
}
