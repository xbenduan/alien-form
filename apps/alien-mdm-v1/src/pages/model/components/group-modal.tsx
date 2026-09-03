import { App, Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { createId, type GroupDraft, type ModelDraft } from "../builder";

interface GroupFormValues {
  title?: string;
  keys: string[];
  props?: string;
}

/**
 * 字段分组弹窗：新增/编辑一个分组。
 * 分组只针对顶层字段；props 用 JSON 文本编辑。
 */
export function GroupModal({
  open,
  group,
  draft,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  /** 编辑时传入现有分组；新增时为 undefined。 */
  group?: GroupDraft;
  draft: ModelDraft;
  onCancel: () => void;
  onSubmit: (group: GroupDraft) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<GroupFormValues>();

  // 顶层字段可选项；已被其它分组占用的字段禁用。
  const fieldOptions = draft.fields.map((node) => ({
    label: `${node.key}（${node.form.title ?? ""}）`,
    value: node.key,
  }));
  const takenElsewhere = new Set(
    draft.groups.flatMap((item) => (item.id === group?.id ? [] : item.keys)),
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      title: group?.title,
      keys: group?.keys ?? [],
      props: group?.props ? JSON.stringify(group.props, null, 2) : "",
    });
  }, [open, group, form]);

  const submit = async () => {
    const values = await form.validateFields();
    let props: Record<string, unknown> | undefined;
    const trimmed = values.props?.trim();
    if (trimmed) {
      try {
        props = JSON.parse(trimmed);
      } catch {
        message.error("分组 props JSON 格式不合法");
        return;
      }
    }
    onSubmit({
      id: group?.id ?? createId(),
      component: group?.component ?? "ObjectField",
      title: values.title?.trim() || undefined,
      keys: values.keys ?? [],
      props,
    });
  };

  return (
    <Modal
      centered
      destroyOnHidden
      open={open}
      title={group ? "编辑分组" : "新增分组"}
      width={560}
      okText="确认"
      cancelText="取消"
      onCancel={onCancel}
      onOk={submit}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="分组标题">
          <Input placeholder="例如 基本信息" />
        </Form.Item>
        <Form.Item name="keys" label="包含字段">
          <Select
            mode="multiple"
            placeholder="选择字段"
            options={fieldOptions.map((option) => ({
              ...option,
              disabled: takenElsewhere.has(option.value),
            }))}
          />
        </Form.Item>
        <Form.Item name="props" label="分组 props(JSON)">
          <Input.TextArea
            placeholder='如 {"gridSpan":12}'
            autoSize={{ minRows: 2, maxRows: 8 }}
            spellCheck={false}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
