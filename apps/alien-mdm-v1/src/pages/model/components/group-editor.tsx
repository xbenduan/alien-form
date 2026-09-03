import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Empty, Input, Select, Space } from "antd";
import { useMemo } from "react";
import { createId, type ModelAction, type ModelDraft } from "../builder";

export function GroupEditor({
  draft,
  dispatch,
}: {
  draft: ModelDraft;
  dispatch: (action: ModelAction) => void;
}) {
  const { message } = App.useApp();
  // 分组只针对顶层字段。
  const fieldOptions = useMemo(
    () =>
      draft.fields.map((node) => ({
        label: `${node.key}（${node.form.title ?? ""}）`,
        value: node.key,
      })),
    [draft.fields],
  );
  const assignedElsewhere = (groupIndex: number) =>
    new Set(draft.groups.flatMap((group, index) => (index === groupIndex ? [] : group.keys)));

  const update = (next: ModelDraft["groups"]) => dispatch({ type: "groups.replace", groups: next });

  const addGroup = () =>
    update([
      ...draft.groups,
      { id: createId(), component: "ObjectField", title: "分组", keys: [] },
    ]);

  /** props 用多行 JSON 文本框编辑：失焦时解析并写回。 */
  const updateProps = (index: number, text: string) => {
    const trimmed = text.trim();
    let props: Record<string, unknown> | undefined;
    if (trimmed) {
      try {
        props = JSON.parse(trimmed);
      } catch {
        message.error(`第 ${index + 1} 个分组的 props JSON 格式不合法`);
        return;
      }
    }
    update(draft.groups.map((item, i) => (i === index ? { ...item, props } : item)));
  };

  return (
    <Card
      title="表单分组"
      extra={
        <Button type="link" onClick={addGroup}>
          新增分组
        </Button>
      }
    >
      {draft.groups.length === 0 ? (
        <Empty description="暂无分组，未分组字段按顺序平铺" />
      ) : (
        <Space vertical size={16} style={{ width: "100%" }}>
          {draft.groups.map((group, index) => {
            const taken = assignedElsewhere(index);
            return (
              <Space key={group.id} align="start" style={{ width: "100%" }}>
                <Space vertical size={8} style={{ flex: 1 }}>
                  <Space align="start" style={{ width: "100%" }}>
                    <Input
                      style={{ width: 160 }}
                      placeholder="分组标题"
                      value={group.title}
                      onChange={(event) =>
                        update(
                          draft.groups.map((item, i) =>
                            i === index ? { ...item, title: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <Select
                      mode="multiple"
                      style={{ minWidth: 320 }}
                      placeholder="选择字段"
                      value={group.keys}
                      options={fieldOptions.map((option) => ({
                        ...option,
                        disabled: taken.has(option.value),
                      }))}
                      onChange={(keys) =>
                        update(
                          draft.groups.map((item, i) => (i === index ? { ...item, keys } : item)),
                        )
                      }
                    />
                  </Space>
                  <Input.TextArea
                    placeholder='分组 props(JSON)，如 {"gridSpan":12}'
                    defaultValue={group.props ? JSON.stringify(group.props, null, 2) : ""}
                    key={JSON.stringify(group.props)}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    spellCheck={false}
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                    onBlur={(event) => updateProps(index, event.target.value)}
                  />
                </Space>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除分组"
                  onClick={() => update(draft.groups.filter((_item, i) => i !== index))}
                />
              </Space>
            );
          })}
        </Space>
      )}
    </Card>
  );
}
