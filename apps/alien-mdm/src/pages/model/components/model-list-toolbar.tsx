import { DownloadOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Space } from "antd";
import { useState } from "react";
import { useRuntime } from "@binding";
import styles from "./index.module.css";

export interface ModelListToolbarProps {
  loading: boolean;
  onAdd: () => void;
  onRefresh: () => void;
}

export function ModelListToolbar({ loading, onAdd, onRefresh }: ModelListToolbarProps) {
  const runtime = useRuntime();
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadModelSkill } = await import("../skills/model-skill");
      await downloadModelSkill(runtime);
      message.success("Skills 下载成功");
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "Skills 下载失败");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.listToolbar}>
      <Space>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={onRefresh}
          aria-label="刷新模型列表"
        >
          刷新
        </Button>
        <Button icon={<DownloadOutlined />} loading={downloading} onClick={() => void download()}>
          下载 Skills
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
          新增模型
        </Button>
      </Space>
    </div>
  );
}
