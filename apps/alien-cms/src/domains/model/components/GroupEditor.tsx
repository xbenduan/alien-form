import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Select } from "antd";
import type { FieldDraft, GroupDraft } from "../types";
import { GROUP_COMPONENT_OPTIONS, createGroupDraft } from "../utils";
import styles from "./GroupEditor.module.css";

interface GroupEditorProps {
  groups: GroupDraft[];
  fields: FieldDraft[];
  onChange: (groups: GroupDraft[]) => void;
}

/** 分组编辑：把顶层字段收进布局容器（Card 等），仅影响 form 渲染。 */
export function GroupEditor({ groups, fields, onChange }: GroupEditorProps) {
  const fieldOptions = fields.map((field) => ({
    value: field.key,
    label: field.title || field.key,
  }));

  const patchGroup = (id: string, partial: Partial<GroupDraft>) => {
    onChange(groups.map((group) => (group.id === id ? { ...group, ...partial } : group)));
  };

  return (
    <div className={styles.editor}>
      {groups.map((group) => (
        <div key={group.id} className={styles.group}>
          <div className={styles.groupHeader}>
            <Input
              className={styles.title}
              placeholder="分组标题"
              value={group.title}
              onChange={(event) => patchGroup(group.id, { title: event.target.value })}
            />
            <Select
              className={styles.component}
              value={group.component}
              options={GROUP_COMPONENT_OPTIONS}
              onChange={(component) => patchGroup(group.id, { component })}
            />
            <InputNumber
              className={styles.gridSpan}
              min={1}
              max={24}
              value={group.gridSpan}
              disabled={group.component !== "GridLayout"}
              placeholder="跨度"
              onChange={(gridSpan) => patchGroup(group.id, { gridSpan: gridSpan ?? 12 })}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange(groups.filter((item) => item.id !== group.id))}
            />
          </div>
          <Select
            mode="multiple"
            className={styles.keys}
            placeholder="选择归入该分组的字段"
            value={group.keys}
            options={fieldOptions}
            onChange={(keys) => patchGroup(group.id, { keys })}
          />
        </div>
      ))}
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => onChange([...groups, createGroupDraft()])}
      >
        添加分组
      </Button>
    </div>
  );
}
