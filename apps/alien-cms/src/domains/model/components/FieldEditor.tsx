import { Input, InputNumber, Select, Space, Switch } from "antd";
import type { FieldDraft } from "../types";
import { FIELD_TYPE_OPTIONS, isContainerType } from "../utils";
import { handlerOptions } from "../../../handles";
import styles from "./FieldEditor.module.css";

interface FieldEditorProps {
  field: FieldDraft;
  onChange: (field: FieldDraft) => void;
}

const HANDLER_SELECT_OPTIONS = [
  { value: "", label: "不联动" },
  ...handlerOptions.map((item) => ({ value: item.value, label: item.label })),
];

const DATA_SOURCE_TYPES = new Set(["select", "multiSelect"]);

/** 单字段配置面板：类型、标题、组件行为、数据源与联动。 */
export function FieldEditor({ field, onChange }: FieldEditorProps) {
  const patch = (partial: Partial<FieldDraft>) => onChange({ ...field, ...partial });
  const container = isContainerType(field.type);
  const showDataSource = DATA_SOURCE_TYPES.has(field.type);

  return (
    <div className={styles.editor}>
      <div className={styles.row}>
        <label className={styles.label}>字段 Key</label>
        <Input value={field.key} onChange={(event) => patch({ key: event.target.value })} />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>标题</label>
        <Input value={field.title} onChange={(event) => patch({ title: event.target.value })} />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>类型</label>
        <Select
          className={styles.control}
          value={field.type}
          options={FIELD_TYPE_OPTIONS}
          onChange={(type) => patch({ type })}
        />
      </div>

      {container ? null : (
        <div className={styles.row}>
          <label className={styles.label}>必填</label>
          <Switch checked={field.required} onChange={(required) => patch({ required })} />
        </div>
      )}

      {showDataSource ? (
        <>
          <div className={styles.row}>
            <label className={styles.label}>联动 handler</label>
            <Select
              className={styles.control}
              value={field.handler ?? ""}
              options={HANDLER_SELECT_OPTIONS}
              onChange={(handler) => patch({ handler: handler || undefined })}
            />
          </div>
          {field.handler ? (
            <div className={styles.row}>
              <label className={styles.label}>handler 参数</label>
              <Input.TextArea
                rows={3}
                value={field.handlerParamsText}
                placeholder={'{ "model": "nail-service", "label": "serviceName", "value": "id" }'}
                onChange={(event) => patch({ handlerParamsText: event.target.value })}
              />
            </div>
          ) : (
            <div className={styles.row}>
              <label className={styles.label}>选项数据源</label>
              <Input.TextArea
                rows={3}
                value={field.dataSourceText}
                placeholder={'[{ "label": "初级", "value": "junior" }]'}
                onChange={(event) => patch({ dataSourceText: event.target.value })}
              />
            </div>
          )}
        </>
      ) : null}

      <div className={styles.row}>
        <label className={styles.label}>列表展示</label>
        <Space>
          <Switch
            checked={field.tableVisible}
            onChange={(tableVisible) => patch({ tableVisible })}
          />
          <InputNumber
            placeholder="列宽"
            value={field.tableWidthText ? Number(field.tableWidthText) : undefined}
            onChange={(value) => patch({ tableWidthText: value ? String(value) : "" })}
          />
        </Space>
      </div>
    </div>
  );
}
