import type { Runtime } from "@alien-form/engine";
import type {
  ListRequest,
  ListResponse,
  SubtreeRequest,
  SubtreeResponse,
} from "@app-types";
import { coalesceRequest } from "@runtime/request-coalescer";
import { transport } from "@runtime/transport";

export function registerRecordServices(runtime: Runtime): void {
  const pendingRecordLists = new Map<string, Promise<ListResponse>>();
  const pendingSubtrees = new Map<string, Promise<SubtreeResponse>>();

  runtime.service("records.list", (request: ListRequest) => {
    const body = JSON.stringify(request);
    return coalesceRequest(pendingRecordLists, body, () =>
      transport.send<ListResponse>("/api/records/list", {
        method: "POST",
        body,
      }),
    );
  });
  runtime.service("records.subtree", (request: SubtreeRequest) => {
    const body = JSON.stringify(request);
    return coalesceRequest(pendingSubtrees, body, () =>
      transport.send<SubtreeResponse>("/api/records/subtree", {
        method: "POST",
        body,
      }),
    );
  });
  runtime.service("records.get", ({ model, id }: { model: string; id: string }) =>
    transport.send<Record<string, unknown>>(
      `/api/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
    ),
  );
  runtime.service("records.create", (modelCode: string, values: Record<string, unknown>) =>
    transport.send<Record<string, unknown>>(`/api/records/${modelCode}`, {
      method: "POST",
      body: JSON.stringify(values),
    }),
  );
  runtime.service(
    "records.update",
    (modelCode: string, id: string, values: Record<string, unknown>) =>
      transport.send<Record<string, unknown>>(`/api/records/${modelCode}/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }),
  );
  runtime.service("records.delete", ({ model, id }: { model: string; id: unknown }) =>
    transport.send<void>(
      `/api/records/${encodeURIComponent(model)}/${encodeURIComponent(String(id))}`,
      { method: "DELETE" },
    ),
  );
  runtime.service("records.batchDelete", ({ model, ids }: { model: string; ids: string[] }) =>
    transport.send<void>(`/api/records/${encodeURIComponent(model)}/batch-delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  );
  runtime.service("record.add", (values: Record<string, unknown>, context: { modelCode: string }) =>
    transport.send<Record<string, unknown>>(
      `/api/records/${encodeURIComponent(context.modelCode)}`,
      {
        method: "POST",
        body: JSON.stringify(values),
      },
    ),
  );
  runtime.service(
    "record.edit",
    (values: Record<string, unknown>, context: { modelCode: string; recordId?: string }) =>
      transport.send<Record<string, unknown>>(
        `/api/records/${encodeURIComponent(context.modelCode)}/${encodeURIComponent(context.recordId ?? "")}`,
        {
          method: "PUT",
          body: JSON.stringify(values),
        },
      ),
  );
}
