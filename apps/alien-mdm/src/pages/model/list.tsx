import { App, Alert, Flex } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumb } from "../../components";
import type { ModelSummary } from "@app-types";
import { transport } from "@runtime/transport";
import { ModelListToolbar } from "./components/model-list-toolbar";
import { ModelTable } from "./components/model-table";

export default function ModelListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setModels(await transport.send<ModelSummary[]>("/api/schemas"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

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
      await transport.send(`/api/schemas/${model.name}`, { method: "DELETE" });
      message.success("删除成功");
      await load();
    },
    [load, message],
  );

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: "模型管理" }]} />
      <ModelListToolbar
        loading={loading}
        onRefresh={() => void load()}
        onAdd={() => navigate("/models/add")}
      />
      {error && <Alert type="error" title="模型列表加载失败" description={error} showIcon />}
      <ModelTable
        dataSource={models}
        loading={loading}
        onView={viewModel}
        onEdit={editModel}
        onCopy={copyModel}
        onDelete={deleteModel}
      />
    </Flex>
  );
}
