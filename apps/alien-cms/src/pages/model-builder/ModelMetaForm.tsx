import { Card, Form, Input, InputNumber, Select, Typography } from 'antd';
import type { ModelBuilderDraft } from '../../types/model-builder';

interface ModelMetaFormProps {
  draft: ModelBuilderDraft;
  onChange: (nextDraft: ModelBuilderDraft) => void;
}

export function ModelMetaForm({ draft, onChange }: ModelMetaFormProps) {
  return (
    <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        模型信息
      </Typography.Title>
      <Form layout="vertical">
        <Form.Item label="模型名">
          <Input
            value={draft.modelName}
            placeholder="例如 product"
            onChange={(event) => onChange({ ...draft, modelName: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="标题">
          <Input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        </Form.Item>
        <Form.Item label="副标题">
          <Input value={draft.subtitle} onChange={(event) => onChange({ ...draft, subtitle: event.target.value })} />
        </Form.Item>
        <Form.Item label="描述">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="单数名称">
          <Input
            value={draft.singularLabel}
            onChange={(event) => onChange({ ...draft, singularLabel: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="复数名称">
          <Input
            value={draft.pluralLabel}
            onChange={(event) => onChange({ ...draft, pluralLabel: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="默认分页大小">
          <InputNumber
            min={1}
            max={100}
            style={{ width: '100%' }}
            value={draft.defaultPageSize}
            onChange={(value) => onChange({ ...draft, defaultPageSize: Number(value ?? 10) })}
          />
        </Form.Item>
        <Form.Item label="默认筛选项数量">
          <InputNumber
            min={1}
            max={12}
            style={{ width: '100%' }}
            value={draft.defaultFilterCount}
            onChange={(value) => onChange({ ...draft, defaultFilterCount: Number(value ?? 3) })}
          />
        </Form.Item>
        <Form.Item label="新增打开方式">
          <Select
            value={draft.openMode.add}
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
            value={draft.openMode.edit}
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
            value={draft.openMode.detail}
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
