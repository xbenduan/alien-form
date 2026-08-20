import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Empty, Input, Tooltip, Typography } from "antd";
import { PageError, PageLoading } from "../../../components";
import { useModelSummaries } from "../../../hooks";
import type { ModelSummary } from "../../../services";
import { modelAddPath, modelListPath, recordListPath } from "../../../app/router/paths";
import styles from "./index.module.css";

function ModelCard({ model, onClick }: { model: ModelSummary; onClick: () => void }) {
  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <span className={styles.cardIcon}>
        <DatabaseOutlined />
      </span>
      <span className={styles.cardContent}>
        <strong className={styles.cardTitle}>{model.title}</strong>
        <Tooltip title={model.description || model.subtitle || model.name}>
          <span className={styles.cardDesc}>
            {model.description || model.subtitle || model.name}
          </span>
        </Tooltip>
        <span className={styles.cardMeta}>{model.fieldCount} 个字段</span>
      </span>
    </button>
  );
}

/** 落地页：展示所有模型，支持搜索与新增入口。 */
export default function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const query = useModelSummaries();
  const models = query.data ?? [];

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return models;
    return models.filter((model) =>
      [model.name, model.title, model.subtitle, model.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [keyword, models]);

  return (
    <main className={`${styles.homepage} ${styles.home}`}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <AppstoreOutlined />
          </span>
          <div>
            <Typography.Text className={styles.kicker}>ALIEN CMS</Typography.Text>
            <Typography.Title
              level={4}
              className={styles.brandTitle}
              style={{ marginTop: 0, marginBottom: 0 }}
            >
              模型工作台
            </Typography.Title>
          </div>
        </div>
        <Button type="link" icon={<SettingOutlined />} onClick={() => navigate(modelListPath())}>
          管理模型
        </Button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined />}
            placeholder="搜索模型名称、标题或描述"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <span className={styles.count}>{filtered.length} 个模型</span>
        </div>
        <button type="button" className={styles.addButton} onClick={() => navigate(modelAddPath())}>
          <AppstoreAddOutlined />
          <span>新增模型</span>
        </button>
      </div>

      {query.isError ? (
        <PageError title="模型列表加载失败" description={(query.error as Error)?.message} />
      ) : query.isLoading ? (
        <PageLoading />
      ) : filtered.length === 0 ? (
        <Empty description={keyword ? "没有匹配的模型" : "还没有可用模型"} />
      ) : (
        <section className={styles.grid} aria-label="模型列表">
          {filtered.map((model) => (
            <ModelCard
              key={model.name}
              model={model}
              onClick={() => navigate(recordListPath(model.name))}
            />
          ))}
        </section>
      )}
    </main>
  );
}
