import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useModelSchema } from "../../../hooks";
import { useCompiledSchema } from "../../../compiler";
import { DataScope } from "../../../runtime";
import { recordAddPath, recordDetailPath, recordEditPath } from "../../../app/router/paths";
import type { OverlayActionState } from "../types";

/**
 * 列表页协调器：只负责 schema 加载/编译、跨组件的 DataScope（筛选/分页/排序联动）
 * 以及 add/edit/detail 的叠加层与路由跳转。
 * 数据获取已下沉到 table/tree 等组件按布局 props.services 语义 key 自取。
 */
export function useRecordPage(modelName: string) {
  const navigate = useNavigate();
  const schemaQuery = useModelSchema(modelName);
  const schema = schemaQuery.data;
  const compiledQuery = useCompiledSchema(schema);
  const compiled = compiledQuery.data;

  const scope = useMemo(() => new DataScope(modelName), [modelName]);
  const [overlay, setOverlay] = useState<OverlayActionState | null>(null);

  useEffect(() => {
    if (schema?.meta.defaultPageSize) {
      scope.setPagination({ current: 1, pageSize: schema.meta.defaultPageSize });
    }
  }, [schema, scope]);

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

    scope,

    overlay,
    openAdd: () => openAction("add"),
    openEdit: (id: string) => openAction("edit", id),
    openDetail: (id: string) => openAction("detail", id),
    closeOverlay: () => setOverlay(null),
  };
}
