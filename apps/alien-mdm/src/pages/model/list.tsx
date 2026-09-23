import { Alert, App, Flex } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRuntime } from "@alien-form/react";
import type { ListResponse, ModelRecord, ModelSummary } from "@app-types";
import { canManageModels } from "@runtime/user-info";
import { ModelListToolbar } from "./components/model-list-toolbar";
import { ModelTable } from "./components/model-table";

export default function ModelListPage() {
  const navigate = useNavigate();
  const runtime = useRuntime();
  const { message } = App.useApp();
  const canManage = canManageModels();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [groupLabels, setGroupLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const listModels = runtime.getService("model.list") as () => Promise<ModelSummary[]>;
      const listRecords = runtime.getService("records.list") as (request: {
        model: string;
        pagination: { current: number; pageSize: number };
      }) => Promise<ListResponse>;
      const [nextModels, categories] = await Promise.all([
        listModels(),
        listRecords({ model: "_sys_model_category", pagination: { current: 1, pageSize: 100 } }),
      ]);
      setModels(nextModels);
      setGroupLabels(
        new Map(
          categories.list.flatMap((category: ModelRecord) =>
            typeof category.code === "string" && typeof category.name === "string"
              ? [[category.code, category.name] as const]
              : [],
          ),
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewModel = useCallback(
    (model: ModelSummary) => navigate(`/records/${model.name}/list`),
    [navigate],
  );
  const editModel = useCallback(
    (model: ModelSummary) => navigate(`/models/${model.name}/edit`),
    [navigate],
  );
  const copyModel = useCallback(
    (model: ModelSummary) => navigate(`/models/${model.name}/copy`),
    [navigate],
  );
  const deleteModel = useCallback(
    async (model: ModelSummary) => {
      const remove = runtime.getService("model.delete") as (modelCode: string) => Promise<void>;
      try {
        await remove(model.name);
        message.success("模型已删除");
        await load();
      } catch (reason) {
        message.error(reason instanceof Error ? reason.message : String(reason));
      }
    },
    [load, message, runtime],
  );
  return (
    <Flex vertical gap={16}>
      <ModelListToolbar
        loading={loading}
        onRefresh={() => void load()}
        onAdd={canManage ? () => navigate("/models/add") : undefined}
      />
      {error && <Alert type="error" title="模型列表加载失败" description={error} showIcon />}
      <ModelTable
        dataSource={models}
        loading={loading}
        canManageModels={canManage}
        groupLabels={groupLabels}
        onView={viewModel}
        onEdit={editModel}
        onCopy={copyModel}
        onDelete={(model) => void deleteModel(model)}
      />
    </Flex>
  );
}
