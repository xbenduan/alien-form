import { useEffect, useMemo, useState } from "react";
import {
  AppstoreOutlined,
  DatabaseOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Alert, Button, Divider, Empty, Input, Skeleton, Tabs, Tooltip, Typography } from "antd";
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

export default function HomePage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelSummary[]>();
  const [error, setError] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");

  useEffect(() => {
    void transport
      .send<ModelSummary[]>("/api/schemas")
      .then(setModels)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

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

  return (
    <main className={styles.home}>
      <header className={styles.topbar}>
        <div className={styles.topbarPrimary}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <AppstoreOutlined />
            </span>
            <div>
              <Typography.Text className={styles.kicker}>ALIEN CMS</Typography.Text>
              <Typography.Title
                level={3}
                className={styles.brandTitle}
                style={{ marginTop: 0, marginBottom: 0 }}
              >
                模型工作台
              </Typography.Title>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <Button type="text" icon={<SettingOutlined />} onClick={() => navigate("/models")}>
              模型管理
            </Button>
            <Divider type="vertical" className={styles.actionDivider} />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <Tabs
          size="large"
          activeKey={group}
          items={GROUP_TABS}
          onChange={(key) => setGroup(key as GroupFilter)}
        />
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
      </div>

      <div className={styles.mainContent}>
        {error ? (
          <Alert type="error" message="模型列表加载失败" description={error} showIcon />
        ) : !models ? (
          <Skeleton active />
        ) : filtered.length === 0 ? (
          <Empty description={keyword ? "没有匹配的模型" : "还没有可用模型"} />
        ) : (
          <section className={styles.grid} aria-label="模型列表">
            {filtered.map((model) => (
              <button
                key={model.name}
                type="button"
                className={styles.card}
                onClick={() => navigate(`/records/${model.name}/list`)}
              >
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
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
