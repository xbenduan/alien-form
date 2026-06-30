import type {
  BuilderComponentName,
  BuilderFieldType,
  ModelBuilderFieldDraft,
} from "@alien-form/cms";
import {
  Button,
  Card,
  DeleteOutlined,
  Empty,
  Form,
  Input,
  PlusOutlined,
  Select,
  Space,
  Switch,
  Typography,
} from "../../../shared/ui";
import {
  builderComponentOptions,
  getBuilderComponentMeta,
  getBuilderComponentOptions,
} from "../../../shared/adapters";
import { HandlerSelectEditor } from "./HandlerSelectEditor";

interface DataSourceItem {
  label: string;
  value: string;
}

function parseDataSourceItems(text: string): DataSourceItem[] {
  if (!text || !text.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (item): item is { label?: unknown; value?: unknown } =>
          Boolean(item) && typeof item === "object",
      )
      .map((item) => ({
        label: typeof item.label === "string" ? item.label : String(item.label ?? ""),
        value: typeof item.value === "string" ? item.value : String(item.value ?? ""),
      }));
  } catch {
    return [];
  }
}

function serializeDataSourceItems(items: DataSourceItem[]): string {
  if (items.length === 0) {
    return "";
  }
  return JSON.stringify(items, null, 2);
}

const fieldTypeOptions: Array<{ label: string; value: BuilderFieldType }> = [
  { label: "string", value: "string" },
  { label: "number", value: "number" },
  { label: "boolean", value: "boolean" },
  { label: "object", value: "object" },
  { label: "void", value: "void" },
  { label: "array", value: "array" },
  { label: "tags", value: "tags" },
];
const SYSTEM_FIELD_KEYS = new Set(["id", "createdAt", "updatedAt"]);

interface FieldConfigPanelProps {
  field?: ModelBuilderFieldDraft;
  onChange: (nextField: ModelBuilderFieldDraft) => void;
  withCard?: boolean;
}

export function FieldConfigPanel({ field, onChange, withCard = true }: FieldConfigPanelProps) {
  const isSystemField = Boolean(field && SYSTEM_FIELD_KEYS.has(field.key));
  const isContainerField = field?.type === "object" || field?.type === "void";
  const isObjectArray = field?.type === "array";
  const supportsPrimitiveConfig = field && !isContainerField && !isObjectArray && !isSystemField;
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
    const nextTypeOptions = getBuilderComponentOptions(nextType);
    const nextDefaultComponent = nextTypeOptions[0]?.value ?? "Input";

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
        component: "ArrayCards",
        decorator: "FormItem",
        required: false,
        arrayMode: "object",
        children: currentField.children ?? [],
        tableInlineFields: currentField.tableInlineFields ?? [],
      };
    }

    if (nextType === "tags") {
      return {
        ...currentField,
        type: "tags",
        component:
          currentField.component === "TagsInput" || currentField.component === "CheckboxGroup"
            ? currentField.component
            : "TagsInput",
        decorator: "FormItem",
        required: false,
        arrayMode: undefined,
        tableInlineFields: [],
        children: undefined,
      };
    }

    return {
      ...currentField,
      type: nextType,
      decorator: "FormItem",
      component:
        currentField.component === "SectionCard" ||
        currentField.component === "ArrayCards" ||
        currentField.component === "TagsInput" ||
        currentField.component === "CheckboxGroup"
          ? nextDefaultComponent
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
        arrayMode: "object",
        children: currentField.children ?? [],
        tableInlineFields: currentField.tableInlineFields,
      };
    }

    if (currentField.type === "tags") {
      return {
        ...currentField,
        component: nextComponent,
        arrayMode: undefined,
        children: undefined,
        tableInlineFields: [],
      };
    }

    if (currentField.type === "object" || currentField.type === "void") {
      return {
        ...currentField,
        component: nextComponent,
        children: currentField.children ?? [],
      };
    }

    return {
      ...currentField,
      component: nextComponent,
    };
  };

  const content = (
    <>
      {!field ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择一个字段" />
      ) : null}

      {field ? (
        <Form layout="vertical">
          <Form.Item
            label="字段 key"
            extra={isSystemField ? "系统字段由后端生成，key / 类型 / 组件不可修改。" : undefined}
          >
            <Input
              value={field.key}
              disabled={isSystemField}
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
              disabled={isSystemField}
              options={fieldTypeOptions}
              onChange={(value) => onChange(buildTypePreset(value, field))}
            />
          </Form.Item>
          <Form.Item label="组件">
            <Select
              value={field.component}
              disabled={isSystemField}
              options={currentComponentOptions}
              onChange={(value) => onChange(buildComponentPreset(value, field))}
            />
          </Form.Item>
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
              disabled={isSystemField}
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
            <Form.Item
              label="数据源 dataSource"
              extra="按选项的展示文本（label）与提交值（value）维护"
            >
              <DataSourceEditor
                value={field.dataSourceText}
                onChange={(nextText) => onChange({ ...field, dataSourceText: nextText })}
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
                  disabled={isSystemField}
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
    </>
  );

  if (!withCard) {
    return content;
  }

  return (
    <Card className="model-query-card" title="字段配置" styles={{ body: { padding: 20 } }}>
      {content}
    </Card>
  );
}

interface DataSourceEditorProps {
  value: string;
  onChange: (nextText: string) => void;
}

function DataSourceEditor({ value, onChange }: DataSourceEditorProps) {
  const items = parseDataSourceItems(value);

  const commit = (nextItems: DataSourceItem[]) => {
    onChange(serializeDataSourceItems(nextItems));
  };

  const updateItem = (index: number, patch: Partial<DataSourceItem>) => {
    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    commit(nextItems);
  };

  const addItem = () => {
    commit([...items, { label: "", value: "" }]);
  };

  const removeItem = (index: number) => {
    commit(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="builder-datasource-editor">
      {items.length === 0 ? (
        <Typography.Text type="secondary" className="builder-datasource-empty">
          暂无选项，点击下方按钮新增
        </Typography.Text>
      ) : (
        <div className="builder-datasource-list">
          <div className="builder-datasource-header">
            <span>label（展示文本）</span>
            <span>value（提交值）</span>
            <span />
          </div>
          {items.map((item, index) => (
            <div key={index} className="builder-datasource-row">
              <Input
                value={item.label}
                placeholder="例如 草稿"
                onChange={(event) => updateItem(index, { label: event.target.value })}
              />
              <Input
                value={item.value}
                placeholder="例如 draft"
                onChange={(event) => updateItem(index, { value: event.target.value })}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label="删除选项"
                onClick={() => removeItem(index)}
              />
            </div>
          ))}
        </div>
      )}
      <Space size={8} className="builder-datasource-actions">
        <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>
          新增选项
        </Button>
      </Space>
    </div>
  );
}
