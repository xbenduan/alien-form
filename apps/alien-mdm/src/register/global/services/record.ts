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
import { sdkClient } from "@runtime/sdk-client";

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
          sdkClient
            .collection(request.model)
            .getList(request.pagination?.current ?? 1, request.pagination?.pageSize ?? 30, {
              filter: request.filter,
              searchFields: request.searchFields,
              keyword: request.keyword,
              parentId: request.parentId,
              sort: request.sorter
                ? `${request.sorter.order === "descend" ? "-" : ""}${request.sorter.field}`
                : undefined,
            })
            .then(({ list, total }) => ({ list, total })),
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
          sdkClient.collection(request.model).getSubtree({
            idField: request.idField,
            parentField: request.parentField,
            parentValue: request.parentValue,
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
        return coalesceRequest(pendingRecordGets, path, () =>
          sdkClient.collection<ModelRecord>(model).getOne(id),
        );
      },
      { description: "读取记录" },
    ),
  );
  runtime.service(
    "records.create",
    defineService(
      (modelCode: string, values: RecordValues) =>
        sdkClient.collection<ModelRecord>(modelCode).create(values),
      { description: "创建记录" },
    ),
  );
  runtime.service(
    "records.update",
    defineService(
      (modelCode: string, id: string, values: RecordValues) =>
        sdkClient.collection<ModelRecord>(modelCode).update(id, values),
      { description: "更新记录" },
    ),
  );
  runtime.service(
    "records.delete",
    defineService(
      ({ model, id }: { model: string; id: unknown }) =>
        sdkClient.collection(model).delete(String(id)),
      { description: "删除记录" },
    ),
  );
  runtime.service(
    "records.batchDelete",
    defineService(
      ({ model, ids }: BatchDeleteRequest & { model: string }) =>
        sdkClient.collection(model).deleteMany(ids),
      { description: "批量删除记录" },
    ),
  );
  runtime.service(
    "record.add",
    defineService(
      (values: RecordValues, context: { modelCode: string }) =>
        sdkClient.collection<ModelRecord>(context.modelCode).create(values),
      { description: "提交新增表单" },
    ),
  );
  runtime.service(
    "record.edit",
    defineService(
      (values: RecordValues, context: { modelCode: string; recordId?: string }) =>
        sdkClient
          .collection<ModelRecord>(context.modelCode)
          .update(context.recordId ?? "", values),
      { description: "提交编辑表单" },
    ),
  );
}
