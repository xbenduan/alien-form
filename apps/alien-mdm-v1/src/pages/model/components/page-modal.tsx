import { App, Input, Modal, Select, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import type { XPage } from "@engine";
import {
  PAGE_TEMPLATES,
  createId,
  findPageTemplate,
  type ModelDraft,
  type PageDraft,
} from "../builder";

/**
 * 页面配置弹窗：新增/编辑一个页面（XPage）。
 * 新增与编辑都直接编辑 JSON；可选择模版，选择后覆盖编辑器原始内容。
 */
export function PageModal({
  open,
  page,
  draft,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  /** 编辑时传入现有页面；新增时为 undefined。 */
  page?: PageDraft;
  draft: ModelDraft;
  onCancel: () => void;
  onSubmit: (page: PageDraft) => void;
}) {
  const { message } = App.useApp();
  const [text, setText] = useState("");

  const modelCode = draft.name.trim() || "model";
  const title = draft.title.trim() || "模型";

  useEffect(() => {
    if (!open) return;
    setText(page ? JSON.stringify(page.page, null, 2) : "");
  }, [open, page]);

  // 选择模版：以模版生成的 JSON 覆盖编辑器内容。
  const applyTemplate = (key: string) => {
    const template = findPageTemplate(key);
    if (!template) return;
    setText(JSON.stringify(template.build(modelCode, title), null, 2));
    message.success(`已套用「${template.label}」模版，可继续编辑`);
  };

  const submit = () => {
    let parsed: XPage;
    try {
      parsed = JSON.parse(text) as XPage;
    } catch {
      message.error("页面 JSON 格式不合法");
      return;
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.router !== "string" ||
      !parsed.router
    ) {
      message.error("页面必须包含字符串类型的 router 字段");
      return;
    }
    if (!parsed.properties || typeof parsed.properties !== "object") {
      message.error("页面必须包含 properties 对象");
      return;
    }
    onSubmit({ id: page?.id ?? createId(), page: parsed });
  };

  return (
    <Modal
      centered
      destroyOnHidden
      open={open}
      title={page ? "编辑页面" : "新增页面"}
      width={720}
      okText="确认"
      cancelText="取消"
      onCancel={onCancel}
      onOk={submit}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space>
          <Typography.Text type="secondary">选择模版：</Typography.Text>
          <Select
            style={{ width: 220 }}
            placeholder="套用模版（覆盖内容）"
            value={undefined}
            options={PAGE_TEMPLATES.map((template) => ({
              label: template.label,
              value: template.key,
            }))}
            onChange={applyTemplate}
          />
        </Space>
        <Input.TextArea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="在此编辑页面 JSON（XPage），或先选择上方模版"
          autoSize={{ minRows: 14, maxRows: 28 }}
          spellCheck={false}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
      </Space>
    </Modal>
  );
}
