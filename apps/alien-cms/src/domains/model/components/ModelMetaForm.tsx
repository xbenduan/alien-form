import { Input, InputNumber, Segmented, Select } from "antd";
import type { ModelDraft, ModelGroup, OpenMode } from "../types";
import { MODEL_GROUP_OPTIONS, OPEN_MODE_OPTIONS } from "../utils";
import styles from "./index.module.css";

interface ModelMetaFormProps {
  draft: ModelDraft;
  nameDisabled?: boolean;
  onChange: (draft: ModelDraft) => void;
}

/** 模型元信息编辑：名称、标题、标签、分页与打开方式。 */
export function ModelMetaForm({ draft, nameDisabled, onChange }: ModelMetaFormProps) {
  const patch = (partial: Partial<ModelDraft>) => onChange({ ...draft, ...partial });
  const patchOpenMode = (key: "add" | "edit" | "detail", mode: OpenMode) =>
    patch({ openMode: { ...draft.openMode, [key]: mode } });

  return (
    <div className={`${styles.modelMetaForm} ${styles.form}`}>
      <div className={styles.row}>
        <label className={styles.label}>模型名 (name)</label>
        <Input
          disabled={nameDisabled}
          placeholder="小写字母、数字和中划线"
          value={draft.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>标题</label>
        <Input value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>副标题</label>
        <Input
          value={draft.subtitle}
          onChange={(event) => patch({ subtitle: event.target.value })}
        />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>描述</label>
        <Input.TextArea
          rows={2}
          value={draft.description}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>模型分组</label>
        <Segmented
          value={draft.group}
          options={MODEL_GROUP_OPTIONS}
          onChange={(value) => patch({ group: value as ModelGroup })}
        />
      </div>
      <div className={styles.grid}>
        <div className={styles.row}>
          <label className={styles.label}>单数标签</label>
          <Input
            value={draft.singularLabel}
            onChange={(event) => patch({ singularLabel: event.target.value })}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label}>复数标签</label>
          <Input
            value={draft.pluralLabel}
            onChange={(event) => patch({ pluralLabel: event.target.value })}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label}>每页条数</label>
          <InputNumber
            min={1}
            className={styles.control}
            value={draft.defaultPageSize}
            onChange={(value) => patch({ defaultPageSize: value ?? 10 })}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label}>筛选项数</label>
          <InputNumber
            min={0}
            className={styles.control}
            value={draft.filterCount}
            onChange={(value) => patch({ filterCount: value ?? 3 })}
          />
        </div>
      </div>
      <div className={styles.grid}>
        {(["add", "edit", "detail"] as const).map((key) => (
          <div key={key} className={styles.row}>
            <label className={styles.label}>
              {key === "add" ? "新增" : key === "edit" ? "编辑" : "详情"}打开方式
            </label>
            <Select
              className={styles.control}
              value={draft.openMode[key]}
              options={OPEN_MODE_OPTIONS}
              onChange={(mode) => patchOpenMode(key, mode as OpenMode)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
