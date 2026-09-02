import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import styles from "./index.module.css";

export interface ModelListToolbarProps {
  loading: boolean;
  onAdd: () => void;
  onRefresh: () => void;
}

export function ModelListToolbar({ loading, onAdd, onRefresh }: ModelListToolbarProps) {
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
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
          新增模型
        </Button>
      </Space>
    </div>
  );
}
