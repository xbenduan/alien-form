import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Input, Spin, Tooltip, Typography } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ModelSummary } from "../types";
import { useModelSummaries } from "../hooks/use-schema-store";
import { buildModelNewPath, buildRecordPath } from "../../../app/router/paths";

function ModelCard({ model, onClick }: { model: ModelSummary; onClick: () => void }) {
  return (
    <button type="button" className="model-home-card" onClick={onClick}>
      <span className="model-home-card-icon">
        <DatabaseOutlined />
      </span>
      <span className="model-home-card-content">
        <strong>{model.title}</strong>
        <Tooltip title={model.description || model.subtitle || model.name}>
          <span className="model-home-card-description">
            {model.description || model.subtitle || model.name}
          </span>
        </Tooltip>
      </span>
    </button>
  );
}

export default function ModelHomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const query = useModelSummaries();
  const models = query.data ?? [];
  const filteredModels = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return models;
    return models.filter((model) =>
      [model.name, model.title, model.subtitle, model.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [keyword, models]);

  return (
    <main className="model-home">
      <header className="model-home-topbar">
        <div className="model-home-brand">
          <span className="model-home-brand-mark">
            <AppstoreOutlined />
          </span>
          <div>
            <Typography.Text className="model-home-kicker">ALIEN CMS</Typography.Text>
            <Typography.Title level={4} style={{ marginTop: "0" }}>
              模型工作台
            </Typography.Title>
          </div>
        </div>
      </header>

      <div className="model-home-toolbar">
        <div className="model-home-search">
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined />}
            placeholder="搜索模型名称、标题或描述"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <span>{filteredModels.length} 个模型</span>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<AppstoreAddOutlined />}
          onClick={() => navigate(buildModelNewPath())}
        >
          新增模型
        </Button>
      </div>

      {query.isError ? (
        <Alert type="error" showIcon message="模型列表加载失败" description={query.error.message} />
      ) : query.isLoading ? (
        <div className="model-page-loading">
          <Spin size="large" />
        </div>
      ) : filteredModels.length === 0 ? (
        <Empty description={keyword ? "没有匹配的模型" : "还没有可用模型"} />
      ) : (
        <section className="model-home-grid" aria-label="模型列表">
          {filteredModels.map((model) => (
            <ModelCard
              key={model.name}
              model={model}
              onClick={() => navigate(buildRecordPath(model.name))}
            />
          ))}
        </section>
      )}
    </main>
  );
}
