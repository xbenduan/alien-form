import type {
  BuilderComponentName,
  BuilderFieldType,
  ModelBuilderFieldDraft,
} from "@alien-form/cms";
import { Card, Empty, Form, Input, Select, Switch, Typography } from "antd";
import {
  builderComponentOptions,
  getBuilderComponentMeta,
  getBuilderComponentOptions,
} from "../../../shared/adapters";
import { HandlerSelectEditor } from "./HandlerSelectEditor";

const fieldTypeOptions: Array<{ label: string; value: BuilderFieldType }> = [
  { label: "string", value: "string" },
  { label: "number", value: "number" },
  { label: "boolean", value: "boolean" },
  { label: "object", value: "object" },
  { label: "void", value: "void" },
  { label: "array", value: "array" },
];

interface FieldConfigPanelProps {
  field?: ModelBuilderFieldDraft;
  onChange: (nextField: ModelBuilderFieldDraft) => void;
}

export function FieldConfigPanel({ field, onChange }: FieldConfigPanelProps) {
  const isContainerField = field?.type === "object" || field?.type === "void";
  const isArrayField = field?.type === "array";
  const isObjectArray = isArrayField && field?.arrayMode === "object";
  const supportsPrimitiveConfig = field && !isContainerField && !isObjectArray;
  const supportsSummaryConfig = Boolean(field) && (isContainerField || isObjectArray);
  const summaryFieldOptions = (field?.children ?? []).map((child) => ({
    label: `${child.title || child.key} (${child.key})`,
    value: child.key,
  }));
  const currentComponentOptions = field
    ? getBuilderComponentOptions(field.type)
    : builderComponentOptions;
  const currentComponentMeta = field ? getBuilderComponentMeta(field.component) : undefined;
  const currentComponentHint = currentComponentMeta?.params?.length
    ? currentComponentMeta.params
        .map((param) => {
          const requiredText = param.required ? "必填" : "可选";
          return `${param.name} (${param.type}, ${requiredText})${param.description ? `: ${param.description}` : ""}`;
        })
        .join("；")
    : currentComponentMeta?.description;

  const buildTypePreset = (
    nextType: BuilderFieldType,
    currentField: ModelBuilderFieldDraft,
  ): ModelBuilderFieldDraft => {
    if (nextType === "object" || nextType === "void") {
      return {
        ...currentField,
        type: nextType,
        component: "SectionCard",
        decorator: undefined,
        required: false,
        tableInlineFields: currentField.tableInlineFields ?? [],
        children: currentField.children ?? [],
        arrayMode: undefined,
      };
    }

    if (nextType === "array") {
      return {
        ...currentField,
        type: "array",
        component: currentField.arrayMode === "object" ? "ArrayCards" : "TagsInput",
        decorator: "FormItem",
        required: false,
        arrayMode: currentField.arrayMode ?? "tags",
        children: currentField.arrayMode === "object" ? (currentField.children ?? []) : [],
        tableInlineFields:
          currentField.arrayMode === "object" ? currentField.tableInlineFields : [],
      };
    }

    return {
      ...currentField,
      type: nextType,
      decorator: "FormItem",
      component:
        nextType === "number"
          ? "NumberInput"
          : nextType === "boolean"
            ? "Switch"
            : currentField.component === "SectionCard" || currentField.component === "ArrayCards"
              ? "Input"
              : currentField.component,
      arrayMode: undefined,
      tableInlineFields: [],
      children: undefined,
    };
  };

  const buildComponentPreset = (
    nextComponent: BuilderComponentName,
    currentField: ModelBuilderFieldDraft,
  ): ModelBuilderFieldDraft => {
    if (currentField.type === "array") {
      return {
        ...currentField,
        component: nextComponent,
        arrayMode: nextComponent === "ArrayCards" ? "object" : "tags",
        children: nextComponent === "ArrayCards" ? (currentField.children ?? []) : [],
        tableInlineFields: nextComponent === "ArrayCards" ? currentField.tableInlineFields : [],
      };
    }

    if (currentField.type === "object" || currentField.type === "void") {
      return {
        ...currentField,
        component: "SectionCard",
        children: currentField.children ?? [],
      };
    }

    return {
      ...currentField,
      component: nextComponent,
    };
  };

  return (
    <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        字段配置
      </Typography.Title>

      {!field ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择一个字段" />
      ) : null}

      {field ? (
        <Form layout="vertical">
          <Form.Item label="字段 key">
            <Input
              value={field.key}
              onChange={(event) => onChange({ ...field, key: event.target.value })}
            />
          </Form.Item>
          <Form.Item label="标题">
            <Input
              value={field.title}
              onChange={(event) => onChange({ ...field, title: event.target.value })}
            />
          </Form.Item>
          <Form.Item label="字段类型">
            <Select
              value={field.type}
              options={fieldTypeOptions}
              onChange={(value) => onChange(buildTypePreset(value, field))}
            />
          </Form.Item>
          <Form.Item label="组件">
            <Select
              value={field.component}
              options={currentComponentOptions}
              onChange={(value) => onChange(buildComponentPreset(value, field))}
            />
          </Form.Item>
          {isArrayField ? (
            <Form.Item label="数组模式">
              <Select
                value={field.arrayMode ?? "tags"}
                options={[
                  { label: "标签数组", value: "tags" },
                  { label: "对象数组", value: "object" },
                ]}
                onChange={(value) =>
                  onChange({
                    ...field,
                    arrayMode: value,
                    component: value === "object" ? "ArrayCards" : "TagsInput",
                    children: value === "object" ? (field.children ?? []) : [],
                  })
                }
              />
            </Form.Item>
          ) : null}
          {isObjectArray ? (
            <Form.Item label="数组项标题">
              <Input
                value={field.itemTitle}
                placeholder="例如 素材项"
                onChange={(event) => onChange({ ...field, itemTitle: event.target.value })}
              />
            </Form.Item>
          ) : null}
          {supportsPrimitiveConfig ? (
            <Form.Item label="默认值 JSON">
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                value={field.defaultValueText}
                placeholder='例如 "默认标题" 或 1'
                onChange={(event) => onChange({ ...field, defaultValueText: event.target.value })}
              />
            </Form.Item>
          ) : null}
          <Form.Item
            label="组件 props JSON"
            extra={currentComponentHint ? `组件说明：${currentComponentHint}` : undefined}
          >
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              value={field.propsText}
              placeholder={
                currentComponentMeta?.description
                  ? `例如 ${JSON.stringify({ placeholder: currentComponentMeta.description })}`
                  : '例如 {"placeholder":"请输入"}'
              }
              onChange={(event) => onChange({ ...field, propsText: event.target.value })}
            />
          </Form.Item>
          {supportsPrimitiveConfig ? (
            <Form.Item label="数据源 dataSource JSON">
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                value={field.dataSourceText}
                placeholder='例如 [{"label":"草稿","value":"draft"}]'
                onChange={(event) => onChange({ ...field, dataSourceText: event.target.value })}
              />
            </Form.Item>
          ) : null}
          <Form.Item label="表格宽度">
            <Input
              value={field.tableWidthText}
              placeholder="例如 180"
              onChange={(event) => onChange({ ...field, tableWidthText: event.target.value })}
            />
          </Form.Item>
          {supportsSummaryConfig ? (
            <Form.Item label="摘要字段">
              <Select
                mode="multiple"
                allowClear
                value={field.tableInlineFields}
                options={summaryFieldOptions}
                placeholder="选择摘要中展示的子字段"
                onChange={(value) => onChange({ ...field, tableInlineFields: value })}
              />
            </Form.Item>
          ) : null}

          <div className="builder-switch-grid">
            {!isContainerField ? (
              <div className="builder-switch-row">
                <span>必填</span>
                <Switch
                  checked={field.required}
                  onChange={(checked) => onChange({ ...field, required: checked })}
                />
              </div>
            ) : null}
            <div className="builder-switch-row">
              <span>表格省略</span>
              <Switch
                checked={field.tableEllipsis}
                onChange={(checked) => onChange({ ...field, tableEllipsis: checked })}
              />
            </div>
          </div>

          {supportsPrimitiveConfig ? (
            <HandlerSelectEditor
              reactions={field.reactions}
              onChange={(reactions) => onChange({ ...field, reactions })}
            />
          ) : null}
        </Form>
      ) : null}
    </Card>
  );
}
