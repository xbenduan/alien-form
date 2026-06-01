import { Card, Empty, Form, Input, Select, Switch, Typography } from 'antd';
import { HandlerSelectEditor } from './HandlerSelectEditor';
import type { BuilderComponentName, BuilderFieldType, ModelBuilderFieldDraft } from '../../types/model-builder';

const fieldTypeOptions: Array<{ label: string; value: BuilderFieldType }> = [
  { label: 'string', value: 'string' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'object', value: 'object' },
  { label: 'void', value: 'void' },
  { label: 'array', value: 'array' },
];

const componentOptions: Array<{ label: string; value: BuilderComponentName }> = [
  { label: 'Input', value: 'Input' },
  { label: 'Textarea', value: 'Textarea' },
  { label: 'NumberInput', value: 'NumberInput' },
  { label: 'Select', value: 'Select' },
  { label: 'Switch', value: 'Switch' },
  { label: 'DateInput', value: 'DateInput' },
  { label: 'Radio', value: 'Radio' },
  { label: 'CheckboxGroup', value: 'CheckboxGroup' },
  { label: 'Rate', value: 'Rate' },
  { label: 'TagsInput', value: 'TagsInput' },
  { label: 'SectionCard', value: 'SectionCard' },
  { label: 'ArrayCards', value: 'ArrayCards' },
];

interface FieldConfigPanelProps {
  field?: ModelBuilderFieldDraft;
  onChange: (nextField: ModelBuilderFieldDraft) => void;
}

export function FieldConfigPanel({ field, onChange }: FieldConfigPanelProps) {
  const isContainerField = field?.type === 'object' || field?.type === 'void';
  const isArrayField = field?.type === 'array';
  const isObjectArray = isArrayField && field?.arrayMode === 'object';
  const supportsPrimitiveConfig = field && !isContainerField && !isObjectArray;
  const currentComponentOptions = !field
    ? componentOptions
    : field.type === 'object' || field.type === 'void'
      ? componentOptions.filter((option) => option.value === 'SectionCard')
      : field.type === 'array'
        ? componentOptions.filter((option) => option.value === 'TagsInput' || option.value === 'ArrayCards')
        : componentOptions.filter((option) => option.value !== 'SectionCard' && option.value !== 'ArrayCards');

  const buildTypePreset = (nextType: BuilderFieldType, currentField: ModelBuilderFieldDraft): ModelBuilderFieldDraft => {
    if (nextType === 'object' || nextType === 'void') {
      return {
        ...currentField,
        type: nextType,
        component: 'SectionCard',
        decorator: undefined,
        required: false,
        filterVisible: false,
        tableVisible: false,
        children: currentField.children ?? [],
        arrayMode: undefined,
      };
    }

    if (nextType === 'array') {
      return {
        ...currentField,
        type: 'array',
        component: currentField.arrayMode === 'object' ? 'ArrayCards' : 'TagsInput',
        decorator: 'FormItem',
        required: false,
        arrayMode: currentField.arrayMode ?? 'tags',
        children: currentField.arrayMode === 'object' ? currentField.children ?? [] : [],
      };
    }

    return {
      ...currentField,
      type: nextType,
      decorator: 'FormItem',
      component:
        nextType === 'number'
          ? 'NumberInput'
          : nextType === 'boolean'
            ? 'Switch'
            : currentField.component === 'SectionCard' || currentField.component === 'ArrayCards'
              ? 'Input'
              : currentField.component,
      arrayMode: undefined,
      children: undefined,
    };
  };

  const buildComponentPreset = (
    nextComponent: BuilderComponentName,
    currentField: ModelBuilderFieldDraft,
  ): ModelBuilderFieldDraft => {
    if (currentField.type === 'array') {
      return {
        ...currentField,
        component: nextComponent,
        arrayMode: nextComponent === 'ArrayCards' ? 'object' : 'tags',
        children: nextComponent === 'ArrayCards' ? currentField.children ?? [] : [],
      };
    }

    if (currentField.type === 'object' || currentField.type === 'void') {
      return {
        ...currentField,
        component: 'SectionCard',
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

      {!field ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择一个字段" /> : null}

      {field ? (
        <Form layout="vertical">
          <Form.Item label="字段 key">
            <Input value={field.key} onChange={(event) => onChange({ ...field, key: event.target.value })} />
          </Form.Item>
          <Form.Item label="标题">
            <Input value={field.title} onChange={(event) => onChange({ ...field, title: event.target.value })} />
          </Form.Item>
          <Form.Item label="字段类型">
            <Select value={field.type} options={fieldTypeOptions} onChange={(value) => onChange(buildTypePreset(value, field))} />
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
                value={field.arrayMode ?? 'tags'}
                options={[
                  { label: '标签数组', value: 'tags' },
                  { label: '对象数组', value: 'object' },
                ]}
                onChange={(value) =>
                  onChange({
                    ...field,
                    arrayMode: value,
                    component: value === 'object' ? 'ArrayCards' : 'TagsInput',
                    children: value === 'object' ? field.children ?? [] : [],
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
          <Form.Item label="组件 props JSON">
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              value={field.propsText}
              placeholder='例如 {"placeholder":"请输入"}'
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

          <div className="builder-switch-grid">
            {!isContainerField ? (
              <div className="builder-switch-row">
                <span>必填</span>
                <Switch checked={field.required} onChange={(checked) => onChange({ ...field, required: checked })} />
              </div>
            ) : null}
            <div className="builder-switch-row">
              <span>筛选可见</span>
              <Switch checked={field.filterVisible} onChange={(checked) => onChange({ ...field, filterVisible: checked })} />
            </div>
            <div className="builder-switch-row">
              <span>默认筛选展示</span>
              <Switch
                checked={field.filterDefaultVisible}
                onChange={(checked) => onChange({ ...field, filterDefaultVisible: checked })}
              />
            </div>
            <div className="builder-switch-row">
              <span>表格可见</span>
              <Switch checked={field.tableVisible} onChange={(checked) => onChange({ ...field, tableVisible: checked })} />
            </div>
            <div className="builder-switch-row">
              <span>表格省略</span>
              <Switch
                checked={field.tableEllipsis}
                onChange={(checked) => onChange({ ...field, tableEllipsis: checked })}
              />
            </div>
            <div className="builder-switch-row">
              <span>详情可见</span>
              <Switch checked={field.detailVisible} onChange={(checked) => onChange({ ...field, detailVisible: checked })} />
            </div>
          </div>

          {supportsPrimitiveConfig ? (
            <HandlerSelectEditor reactions={field.reactions} onChange={(reactions) => onChange({ ...field, reactions })} />
          ) : null}
        </Form>
      ) : null}
    </Card>
  );
}
