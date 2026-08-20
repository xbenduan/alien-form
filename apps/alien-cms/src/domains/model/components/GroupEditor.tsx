import { useEffect } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select } from "antd";
import type { FieldDraft, GroupDraft } from "../types";
import { GROUP_COMPONENT_OPTIONS, createGroupDraft } from "../utils";
import styles from "./index.module.css";

interface GroupEditorProps {
  groups: GroupDraft[];
  fields: FieldDraft[];
  onChange: (groups: GroupDraft[]) => void;
}

/** 分组编辑：把顶层字段收进 GridLayout 容器，仅影响 form 渲染。 */
export function GroupEditor({ groups, fields, onChange }: GroupEditorProps) {
  const [form] = Form.useForm<{ groups: GroupDraft[] }>();
  const watchedGroups = Form.useWatch("groups", form);
  const fieldOptions = fields.map((field) => ({
    value: field.key,
    label: field.title || field.key,
  }));

  // 外部草稿变化（如 edit 模式载入或 JSON 导入）时同步回表单。
  useEffect(() => {
    form.setFieldsValue({ groups });
  }, [groups, form]);

  return (
    <Form
      form={form}
      className={`${styles.groupEditor} ${styles.editor}`}
      initialValues={{ groups }}
      onValuesChange={(_, values) =>
        onChange(
          (values.groups ?? []).map((group) => ({
            ...group,
            gridSpan: group.gridSpan ?? 12,
          })),
        )
      }
    >
      <Form.List name="groups">
        {(items, { add, remove }) => (
          <>
            {items.map(({ key, name }) => (
              <div key={key} className={styles.group}>
                <div className={styles.groupHeader}>
                  <Form.Item name={[name, "title"]} noStyle>
                    <Input className={styles.title} placeholder="分组标题" />
                  </Form.Item>
                  <Form.Item name={[name, "component"]} noStyle>
                    <Select className={styles.component} options={GROUP_COMPONENT_OPTIONS} />
                  </Form.Item>
                  <Form.Item name={[name, "gridSpan"]} noStyle>
                    <InputNumber
                      className={styles.gridSpan}
                      min={1}
                      max={24}
                      placeholder="跨度"
                      disabled={watchedGroups?.[name]?.component !== "GridLayout"}
                    />
                  </Form.Item>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(name)}
                  />
                </div>
                <Form.Item name={[name, "keys"]} noStyle>
                  <Select
                    mode="multiple"
                    className={styles.keys}
                    placeholder="选择归入该分组的字段"
                    options={fieldOptions}
                  />
                </Form.Item>
              </div>
            ))}
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => add(createGroupDraft())}
            >
              添加分组
            </Button>
          </>
        )}
      </Form.List>
    </Form>
  );
}
