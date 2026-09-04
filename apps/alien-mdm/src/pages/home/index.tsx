import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Input, Skeleton, Tabs, Tooltip, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { UserMenu } from "../../components";
import type { ModelSummary } from "@app-types";
import { transport } from "@runtime/transport";
import styles from "./index.module.css";

type GroupFilter = "all" | "system" | "other";

const GROUP_TABS = [
  { key: "all", label: "全部" },
  { key: "system", label: "系统" },
  { key: "other", label: "其他" },
];

const FAVORITE_MODELS_KEY = "alien-mdm:favorite-models:v1";
const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});

function readFavoriteModelNames(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const value = localStorage.getItem(FAVORITE_MODELS_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFavoriteModelNames(names: string[]): void {
  try {
    localStorage.setItem(FAVORITE_MODELS_KEY, JSON.stringify(names));
  } catch {
    // Favorites are an enhancement and must not block model access.
  }
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间未知";
  return `${UPDATED_AT_FORMATTER.format(date)} 更新`;
}

function ModelCard({
  model,
  onOpen,
  favorite,
  onToggleFavorite,
}: {
  model: ModelSummary;
  onOpen: (model: ModelSummary) => void;
  favorite: boolean;
  onToggleFavorite: (model: ModelSummary) => void;
}) {
  const isSystem = model.group === "system";
  const description = model.description || model.subtitle || model.name;

  return (
    <article className={styles.card}>
      <button type="button" className={styles.cardMain} onClick={() => onOpen(model)}>
        <span
          className={`${styles.cardIcon} ${isSystem ? styles.systemIcon : styles.businessIcon}`}
        >
          {isSystem ? <SafetyCertificateOutlined /> : <DatabaseOutlined />}
        </span>
        <span className={styles.cardContent}>
          <strong className={styles.cardTitle}>{model.title}</strong>
          <Tooltip title={description}>
            <span className={styles.cardDesc}>{description}</span>
          </Tooltip>
          <span className={styles.cardFooter}>
            <span className={`${styles.groupTag} ${isSystem ? styles.systemTag : ""}`}>
              {isSystem ? "系统模型" : "业务模型"}
            </span>
            <span>{model.fieldCount} 个字段</span>
            <span className={styles.updatedAt}>
              <ClockCircleOutlined />
              {formatUpdatedAt(model.updatedAt)}
            </span>
          </span>
        </span>
      </button>
      <Tooltip title={favorite ? "取消收藏" : "收藏"}>
        <Button
          type="text"
          shape="circle"
          className={`${styles.favoriteButton}${favorite ? ` ${styles.favoriteActive}` : ""}`}
          icon={favorite ? <StarFilled /> : <StarOutlined />}
          aria-label={favorite ? `取消收藏${model.title}` : `收藏${model.title}`}
          onClick={() => onToggleFavorite(model)}
        />
      </Tooltip>
    </article>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelSummary[]>();
  const [error, setError] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [favoriteModelNames, setFavoriteModelNames] = useState(readFavoriteModelNames);

  useEffect(() => {
    void transport
      .send<ModelSummary[]>("/api/schemas")
      .then(setModels)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const favoriteModels = useMemo(() => {
    if (!models?.length || !favoriteModelNames.length) return [];
    const modelsByName = new Map(models.map((model) => [model.name, model]));
    return favoriteModelNames.flatMap((name) => {
      const model = modelsByName.get(name);
      return model ? [model] : [];
    });
  }, [favoriteModelNames, models]);

  const favoriteModelNameSet = useMemo(() => new Set(favoriteModelNames), [favoriteModelNames]);

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return (models ?? []).filter((model) => {
      if (group !== "all" && (model.group ?? "other") !== group) return false;
      if (!normalized) return true;
      return [model.name, model.title, model.subtitle, model.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [group, keyword, models]);

  const openModel = useCallback(
    (model: ModelSummary) => {
      navigate(`/records/${model.name}/list`);
    },
    [navigate],
  );

  const toggleFavorite = useCallback(
    (model: ModelSummary) => {
      const next = favoriteModelNameSet.has(model.name)
        ? favoriteModelNames.filter((name) => name !== model.name)
        : [...favoriteModelNames, model.name];
      writeFavoriteModelNames(next);
      setFavoriteModelNames(next);
    },
    [favoriteModelNameSet, favoriteModelNames],
  );

  return (
    <main className={styles.home}>
      <header className={styles.topbar}>
        <div className={styles.topbarPrimary}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <AppstoreOutlined />
            </span>
            <div>
              <Typography.Text className={styles.kicker}>CONTENT OPERATIONS</Typography.Text>
              <Typography.Title
                level={3}
                className={styles.brandTitle}
                style={{ marginTop: 0, marginBottom: 0 }}
              >
                ALIEN CMS
              </Typography.Title>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <Tooltip title="新增模型">
              <Button
                type="text"
                shape="circle"
                icon={<AppstoreAddOutlined />}
                aria-label="新增模型"
                onClick={() => navigate("/models/add")}
              />
            </Tooltip>
            <Tooltip title="模型管理">
              <Button
                type="text"
                shape="circle"
                icon={<UnorderedListOutlined />}
                aria-label="模型管理"
                onClick={() => navigate("/models")}
              />
            </Tooltip>
            <span className={styles.actionDivider} />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className={styles.mainContent}>
        {error ? (
          <Alert type="error" title="模型列表加载失败" description={error} showIcon />
        ) : !models ? (
          <section className={styles.grid} aria-label="正在加载模型">
            {Array.from({ length: 4 }, (_, index) => (
              <div className={styles.skeletonCard} key={index}>
                <Skeleton active avatar paragraph={{ rows: 2 }} title={{ width: "45%" }} />
              </div>
            ))}
          </section>
        ) : (
          <>
            {favoriteModels.length > 0 ? (
              <section className={styles.favoriteSection} aria-labelledby="favorite-models-title">
                <div className={styles.sectionHeader}>
                  <div>
                    <Typography.Title level={2} id="favorite-models-title">
                      收藏模型
                    </Typography.Title>
                    <Typography.Text>固定常用的数据入口</Typography.Text>
                  </div>
                </div>
                <div className={styles.grid}>
                  {favoriteModels.map((model) => (
                    <ModelCard
                      key={model.name}
                      model={model}
                      favorite
                      onOpen={openModel}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.allModels} aria-label="全部模型">
              <div className={styles.toolbar}>
                <Tabs
                  className={styles.tabs}
                  size="large"
                  activeKey={group}
                  items={GROUP_TABS}
                  onChange={(key) => setGroup(key as GroupFilter)}
                  tabBarExtraContent={
                    <div className={styles.search}>
                      <span className={styles.count}>{filtered.length} 个模型</span>
                      <Input
                        size="large"
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="搜索模型名称、标题或描述"
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                      />
                    </div>
                  }
                />
              </div>

              {filtered.length === 0 ? (
                <div className={styles.empty}>
                  <Empty description={keyword ? "没有匹配的模型" : "还没有可用模型"} />
                </div>
              ) : (
                <div className={styles.grid}>
                  {filtered.map((model) => (
                    <ModelCard
                      key={model.name}
                      model={model}
                      favorite={favoriteModelNameSet.has(model.name)}
                      onOpen={openModel}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
