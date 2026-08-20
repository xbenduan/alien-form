import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppstoreOutlined, DatabaseOutlined, SearchOutlined } from "@ant-design/icons";
import { Empty, Input, Segmented, Tooltip, Typography } from "antd";
import { PageError, PageLoading } from "../../../components";
import { useModelSummaries } from "../../../hooks";
import type { ModelGroup, ModelSummary } from "../../../services";
import { recordListPath } from "../../../app/router/paths";
import { UserMenu } from "../components";
import styles from "./index.module.css";

/** Segmented 分组筛选值：all 表示不限分组。 */
type GroupFilter = "all" | ModelGroup;

const GROUP_OPTIONS: { value: GroupFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "system", label: "系统" },
  { value: "other", label: "其他" },
];

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

/** 落地页：展示所有模型，支持按分组切换与关键字搜索。 */
export default function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const query = useModelSummaries();
  const models = query.data ?? [];

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return models.filter((model) => {
      if (group !== "all" && (model.group ?? "other") !== group) return false;
      if (!normalized) return true;
      return [model.name, model.title, model.subtitle, model.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [keyword, group, models]);

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
              level={5}
              className={styles.brandTitle}
              style={{ marginTop: 0, marginBottom: 0 }}
            >
              模型工作台
            </Typography.Title>
          </div>
        </div>
        <UserMenu />
      </header>

      <div className={styles.toolbar}>
        <Segmented
          value={group}
          options={GROUP_OPTIONS}
          onChange={(value) => setGroup(value as GroupFilter)}
        />
        <div className={styles.search}>
          <span className={styles.count}>{filtered.length} 个模型</span>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索模型名称、标题或描述"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
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
