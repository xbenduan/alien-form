import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Select, Space } from "antd";
import { useMemo } from "react";
import { createId, type ModelAction, type ModelDraft } from "../builder";

export function GroupEditor({
  draft,
  dispatch,
}: {
  draft: ModelDraft;
  dispatch: (action: ModelAction) => void;
}) {
  // 分组只针对顶层字段。
  const fieldOptions = useMemo(
    () => draft.fields.map((node) => ({ label: `${node.key}（${node.form.title ?? ""}）`, value: node.key })),
    [draft.fields],
  );
  const assignedElsewhere = (groupIndex: number) =>
    new Set(draft.groups.flatMap((group, index) => (index === groupIndex ? [] : group.keys)));

  const update = (next: ModelDraft["groups"]) => dispatch({ type: "groups.replace", groups: next });

  const addGroup = () =>
    update([...draft.groups, { id: createId(), component: "ObjectField", title: "分组", keys: [] }]);

  return (
    <div>
      <Space style={{ marginBottom: 12, justifyContent: "space-between", width: "100%" }}>
        <strong>分组配置</strong>
        <Button icon={<PlusOutlined />} onClick={addGroup}>
          新增分组
        </Button>
      </Space>
      {draft.groups.length === 0 ? (
        <Empty description="暂无分组，未分组字段按顺序平铺" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {draft.groups.map((group, index) => {
            const taken = assignedElsewhere(index);
            return (
              <Space key={group.id} align="start" style={{ width: "100%" }}>
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
                    update(draft.groups.map((item, i) => (i === index ? { ...item, keys } : item)))
                  }
                />
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
    </div>
  );
}
