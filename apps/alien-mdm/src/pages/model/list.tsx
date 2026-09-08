import { Alert, Flex } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRuntime } from "@alien-form/react";
import { PageBreadcrumb } from "../../components";
import type { ModelSummary } from "@app-types";
import { isSuperAdmin } from "@runtime/user-info";
import { ModelListToolbar } from "./components/model-list-toolbar";
import { ModelTable } from "./components/model-table";

export default function ModelListPage() {
  const navigate = useNavigate();
  const runtime = useRuntime();
  const canManageModels = isSuperAdmin();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const listModels = runtime.getService("model.list") as () => Promise<ModelSummary[]>;
      setModels(await listModels());
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
  return (
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: "模型管理" }]} />
      <ModelListToolbar
        loading={loading}
        onRefresh={() => void load()}
        onAdd={canManageModels ? () => navigate("/models/add") : undefined}
      />
      {error && <Alert type="error" title="模型列表加载失败" description={error} showIcon />}
      <ModelTable
        dataSource={models}
        loading={loading}
        canManageModels={canManageModels}
        onView={viewModel}
        onEdit={editModel}
        onCopy={copyModel}
      />
    </Flex>
  );
}
