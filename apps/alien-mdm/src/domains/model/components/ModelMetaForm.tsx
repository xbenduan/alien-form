import { useEffect } from "react";
import { Form, Input, InputNumber, Select } from "antd";
import { useBuilder, useBuilderAtom } from "@alien-form/builder/react";
import type { ModelDraft } from "../builder";
import { MODEL_GROUP_OPTIONS, OPEN_MODE_OPTIONS } from "../utils";
import styles from "./index.module.css";

interface ModelMetaFormProps {
  nameDisabled?: boolean;
}

const OPEN_MODE_FIELDS = [
  { key: "add", label: "新增打开方式" },
  { key: "edit", label: "编辑打开方式" },
  { key: "detail", label: "详情打开方式" },
] as const;

/** 模型元信息编辑：名称、标题、标签、分页与打开方式。 */
export function ModelMetaForm({ nameDisabled }: ModelMetaFormProps) {
  const builder = useBuilder<ModelDraft>();
  const draft = useBuilderAtom(builder.document);
  const [form] = Form.useForm<ModelDraft>();

  // 外部草稿变化（如 edit 模式异步载入 schema）时同步回表单。
  useEffect(() => {
    form.setFieldsValue(draft);
  }, [draft, form]);

  return (
    <Form
      className={styles.modelMetaForm}
      form={form}
      layout="horizontal"
      labelCol={{ flex: "110px" }}
      labelAlign="left"
      colon={false}
      initialValues={draft}
      onValuesChange={(_, values) =>
        builder.dispatch("meta.update", {
          ...values,
          defaultPageSize: values.defaultPageSize ?? 10,
          filterCount: values.filterCount ?? 3,
        })
      }
    >
      <Form.Item label="模型名 (name)" name="name">
        <Input disabled={nameDisabled} placeholder="小写字母、数字和中划线" />
      </Form.Item>
      <Form.Item label="标题" name="title">
        <Input />
      </Form.Item>
      <Form.Item label="副标题" name="subtitle">
        <Input />
      </Form.Item>
      <Form.Item label="描述" name="description">
        <Input.TextArea rows={2} />
      </Form.Item>

      <div className={styles.grid}>
        <Form.Item label="模型分组" name="group">
          <Select options={MODEL_GROUP_OPTIONS} />
        </Form.Item>
        <Form.Item label="单数标签" name="singularLabel">
          <Input />
        </Form.Item>
        <Form.Item label="复数标签" name="pluralLabel">
          <Input />
        </Form.Item>
        <Form.Item label="每页条数" name="defaultPageSize">
          <InputNumber min={1} className={styles.control} />
        </Form.Item>
        <Form.Item label="筛选项数" name="filterCount">
          <InputNumber min={0} className={styles.control} />
        </Form.Item>
      </div>

      <div className={styles.grid}>
        {OPEN_MODE_FIELDS.map(({ key, label }) => (
          <Form.Item key={key} label={label} name={["openMode", key]}>
            <Select className={styles.control} options={OPEN_MODE_OPTIONS} />
          </Form.Item>
        ))}
      </div>
    </Form>
  );
}
