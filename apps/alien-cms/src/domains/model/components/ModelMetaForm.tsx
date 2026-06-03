import type { ModelBuilderDraft } from '@alien-form/cms';
import { Card, Form, Input, InputNumber, Select, Typography } from 'antd';

interface ModelMetaFormProps {
  draft: ModelBuilderDraft;
  onChange: (nextDraft: ModelBuilderDraft) => void;
  hideTitle?: boolean;
  modelNameDisabled?: boolean;
  tableFieldOptions: Array<{ label: string; value: string }>;
}

export function ModelMetaForm({ draft, onChange, hideTitle, modelNameDisabled, tableFieldOptions }: ModelMetaFormProps) {
  return (
    <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
      {hideTitle ? null : (
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          x-model 配置
        </Typography.Title>
      )}
      <Form layout="vertical" size="middle">
        <Form.Item label="模型名（唯一标识）" required>
          <Input
            value={draft.modelName}
            disabled={modelNameDisabled}
            placeholder="如 product、order-item（小写字母+数字+中划线）"
            onChange={(event) => onChange({ ...draft, modelName: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="模型标题" required>
          <Input
            value={draft.title}
            placeholder="如：商品管理、订单项"
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="副标题">
          <Input
            value={draft.subtitle}
            placeholder="可选，显示在标题下方"
            onChange={(event) => onChange({ ...draft, subtitle: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="描述">
          <Input.TextArea
            value={draft.description}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="可选，模型用途描述"
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="单数标签">
          <Input
            value={draft.singularLabel}
            placeholder="如：记录、商品、订单"
            onChange={(event) => onChange({ ...draft, singularLabel: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="复数标签">
          <Input
            value={draft.pluralLabel}
            placeholder="如：记录、商品、订单"
            onChange={(event) => onChange({ ...draft, pluralLabel: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="默认每页条数">
          <InputNumber
            min={5}
            max={100}
            value={draft.defaultPageSize}
            onChange={(value) => onChange({ ...draft, defaultPageSize: value ?? 10 })}
          />
        </Form.Item>
        <Form.Item label="默认筛选项数量">
          <InputNumber
            min={1}
            max={10}
            value={draft.filterCount}
            onChange={(value) => onChange({ ...draft, filterCount: value ?? 3 })}
          />
        </Form.Item>
        <Form.Item label="表格默认宽度">
          <InputNumber
            min={80}
            max={480}
            value={draft.tableDefaultWidth}
            placeholder="为空时走渲染层默认公式"
            onChange={(value) => onChange({ ...draft, tableDefaultWidth: value ?? undefined })}
          />
        </Form.Item>
        <Form.Item label="表格展示字段">
          <Select
            mode="multiple"
            allowClear
            value={draft.tableVisibleFields}
            options={tableFieldOptions}
            placeholder="为空时默认展示全部第一层字段"
            onChange={(value) => onChange({ ...draft, tableVisibleFields: value })}
          />
        </Form.Item>
        <Form.Item label="新增打开方式">
          <Select
            value={draft.openMode.add ?? 'drawer'}
            options={[
              { label: '抽屉', value: 'drawer' },
              { label: '弹窗', value: 'modal' },
              { label: '页面', value: 'page' },
            ]}
            onChange={(value) => onChange({ ...draft, openMode: { ...draft.openMode, add: value } })}
          />
        </Form.Item>
        <Form.Item label="编辑打开方式">
          <Select
            value={draft.openMode.edit ?? 'drawer'}
            options={[
              { label: '抽屉', value: 'drawer' },
              { label: '弹窗', value: 'modal' },
              { label: '页面', value: 'page' },
            ]}
            onChange={(value) => onChange({ ...draft, openMode: { ...draft.openMode, edit: value } })}
          />
        </Form.Item>
        <Form.Item label="详情打开方式">
          <Select
            value={draft.openMode.detail ?? 'drawer'}
            options={[
              { label: '抽屉', value: 'drawer' },
              { label: '弹窗', value: 'modal' },
              { label: '页面', value: 'page' },
            ]}
            onChange={(value) => onChange({ ...draft, openMode: { ...draft.openMode, detail: value } })}
          />
        </Form.Item>
      </Form>
    </Card>
  );
}
