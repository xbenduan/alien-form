import { useEffect, useRef } from "react";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select } from "antd";
import { useBuilder, useBuilderAtom } from "@alien-form/builder/react";
import { ModelCodec, type GroupDraft, type ModelDraft } from "../builder";
import { GROUP_COMPONENT_OPTIONS } from "../utils";
import styles from "./index.module.css";

/** 分组编辑：把顶层字段收进 GridLayout 容器，仅影响 form 渲染。 */
export function GroupEditor() {
  const builder = useBuilder<ModelDraft>();
  const document = useBuilderAtom(builder.document);
  const { groups, fields } = document;
  const codec = useRef(new ModelCodec()).current;
  const [form] = Form.useForm<{ groups: GroupDraft[] }>();
  const watchedGroups = Form.useWatch("groups", form);
  const fieldOptions = fields.map((field) => ({
    value: field.fields.key ?? "",
    label: field.fields.title || field.fields.key || "",
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
        builder.dispatch(
          "groups.replace",
          (values.groups ?? []).map((group) => ({
            ...group,
            gridSpan: group.gridSpan ?? 12,
          })),
        )
      }
    >
      <Form.List name="groups">
        {(items) => (
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
                    icon={<ArrowUpOutlined />}
                    disabled={name === 0}
                    aria-label="上移分组"
                    onClick={() => builder.dispatch("group.move", { from: name, to: name - 1 })}
                  />
                  <Button
                    type="text"
                    icon={<ArrowDownOutlined />}
                    disabled={name === groups.length - 1}
                    aria-label="下移分组"
                    onClick={() => builder.dispatch("group.move", { from: name, to: name + 1 })}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      builder.dispatch("group.remove", { id: groups[name]?.id })
                    }
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
              onClick={() => builder.dispatch("group.add", { group: codec.createGroup() })}
            >
              添加分组
            </Button>
          </>
        )}
      </Form.List>
    </Form>
  );
}
