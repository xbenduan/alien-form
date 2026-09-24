import { DownloadOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Flex, Input, Space } from "antd";
import { useState } from "react";

export interface ModelListToolbarProps {
  keyword: string;
  loading: boolean;
  onKeywordChange: (keyword: string) => void;
  onAdd?: () => void;
  onRefresh: () => void;
}

export function ModelListToolbar({
  keyword,
  loading,
  onKeywordChange,
  onAdd,
  onRefresh,
}: ModelListToolbarProps) {
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadModelSkill } = await import("../skills/model-skill");
      await downloadModelSkill();
      message.success("Skills 下载成功");
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "Skills 下载失败");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Flex justify="space-between" align="center" className="mb-4 flex-wrap gap-3">
      <Input.Search
        allowClear
        value={keyword}
        placeholder="搜索模型名称、标题或描述"
        onChange={(event) => onKeywordChange(event.target.value)}
        className="w-full max-w-[320px]"
      />
      <Space wrap>
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
        {onAdd ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            新增模型
          </Button>
        ) : null}
      </Space>
    </Flex>
  );
}
