import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SchemaRecord } from "@alien-form/shared";
import { useModelSchema, useRecordList, useRecordMutations } from "../../../hooks";
import { useCompiledSchema } from "../../../compiler";
import type { Pagination, Sorter } from "../../../services";
import { recordAddPath, recordDetailPath, recordEditPath } from "../../../app/router/paths";
import type { OverlayActionState } from "../types";

/**
 * 列表页状态中枢：聚合 schema、编译产物（form/filter/table）、列表查询、
 * 筛选/分页/排序与增删改。
 * 打开 add/edit/detail 时：openMode=page 走路由跳转，drawer/modal 走本页叠加层。
 */
export function useRecordPage(modelName: string) {
  const navigate = useNavigate();
  const schemaQuery = useModelSchema(modelName);
  const schema = schemaQuery.data;
  const compiledQuery = useCompiledSchema(schema);
  const compiled = compiledQuery.data;

  const [filters, setFilters] = useState<SchemaRecord>({});
  const [pagination, setPagination] = useState<Pagination>({ current: 1, pageSize: 10 });
  const [sorter, setSorter] = useState<Sorter>();
  const [overlay, setOverlay] = useState<OverlayActionState | null>(null);

  const listQuery = useRecordList({
    model: modelName,
    filters,
    pagination,
    sorter,
    enabled: Boolean(schema),
  });
  const mutations = useRecordMutations(modelName);

  const openAction = (mode: "add" | "edit" | "detail", recordId?: string) => {
    const openMode = schema?.meta.openMode[mode] ?? "drawer";
    if (openMode === "page") {
      if (mode === "add") navigate(recordAddPath(modelName));
      else if (mode === "edit") navigate(recordEditPath(modelName, recordId!));
      else navigate(recordDetailPath(modelName, recordId!));
      return;
    }
    setOverlay({ mode, openMode, recordId });
  };

  return {
    modelName,
    schema,
    compiled,
    schemaLoading: schemaQuery.isLoading || compiledQuery.isLoading,
    schemaError: (schemaQuery.error ?? compiledQuery.error) as Error | null,

    records: listQuery.data?.list ?? [],
    total: listQuery.data?.total ?? 0,
    listLoading: listQuery.isFetching,

    filters,
    setFilters: (values: SchemaRecord) => {
      setFilters(values);
      setPagination((current) => ({ ...current, current: 1 }));
    },
    pagination,
    setPagination,
    sorter,
    setSorter,

    overlay,
    openAdd: () => openAction("add"),
    openEdit: (id: string) => openAction("edit", id),
    openDetail: (id: string) => openAction("detail", id),
    closeOverlay: () => setOverlay(null),

    submitting: mutations.submitting,
    deleting: mutations.deleting,
    createRecord: mutations.createRecord,
    updateRecord: mutations.updateRecord,
    removeRecord: mutations.deleteRecord,
    removeRecords: mutations.deleteRecords,
    refresh: () => listQuery.refetch(),
  };
}
