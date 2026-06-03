import { DeleteOutlined, DownOutlined, DragOutlined, PlusOutlined } from '@ant-design/icons';
import type { ModelBuilderFieldDraft } from '@alien-form/cms';
import { Button, Card, Dropdown, Empty, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { fieldPresets, type FieldPreset } from './FieldPalette';

interface FieldListEditorProps {
  fields: ModelBuilderFieldDraft[];
  selectedFieldId?: string;
  onSelect: (fieldId: string) => void;
  onRemove: (fieldId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onAddField: (preset: FieldPreset, parentId?: string) => void;
}

export function FieldListEditor({
  fields,
  selectedFieldId,
  onSelect,
  onRemove,
  onMove,
  onAddField,
}: FieldListEditorProps) {
  const [draggingId, setDraggingId] = useState<string>();

  const buildAddButton = (parentId?: string, label = '点击添加字段') => (
    <Dropdown
      trigger={['click']}
      menu={{
        items: fieldPresets.map((preset) => ({
          key: preset.key,
          label: preset.label,
        })),
        onClick: ({ key }) => {
          const preset = fieldPresets.find((item) => item.key === key);
          if (preset) {
            onAddField(preset, parentId);
          }
        },
      }}
    >
      <Button type="dashed" block icon={<PlusOutlined />}>
        {label} <DownOutlined />
      </Button>
    </Dropdown>
  );

  const getSlotMeta = (field: ModelBuilderFieldDraft) => {
    if (field.type === 'object') {
      return {
        label: '对象插槽',
        description: '该组件内部提供对象字段插槽，用于继续配置子字段。',
      };
    }
    if (field.type === 'void') {
      return {
        label: '布局插槽',
        description: '该组件内部提供布局插槽，用于承载一组展示/录入字段。',
      };
    }
    if (field.type === 'array') {
      return {
        label: field.itemTitle || '数组项插槽',
        description: '该组件内部提供数组项插槽，用于定义每一行对象的字段结构。',
      };
    }
    return undefined;
  };

  const renderField = (field: ModelBuilderFieldDraft, index: number, level = 0) => (
    <div key={field.id} className="builder-field-tree-node" style={{ paddingLeft: level * 18 }}>
      <div
        draggable={level === 0}
        className={`builder-field-item ${selectedFieldId === field.id ? 'is-active' : ''}`}
        onClick={() => onSelect(field.id)}
        onDragStart={() => setDraggingId(field.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (level !== 0) {
            setDraggingId(undefined);
            return;
          }
          const fromIndex = fields.findIndex((item) => item.id === draggingId);
          if (fromIndex >= 0 && fromIndex !== index) {
            onMove(fromIndex, index);
          }
          setDraggingId(undefined);
        }}
        onDragEnd={() => setDraggingId(undefined)}
      >
        <Space align="center" size={8}>
          <DragOutlined />
          <div>
            <Typography.Text strong>{field.title || '未命名字段'}</Typography.Text>
            <div className="builder-field-item-meta">
              <span>{field.key || '未设置 key'}</span>
              <Tag variant="filled">{field.type}</Tag>
              <Tag variant="filled">{field.component}</Tag>
            </div>
          </div>
        </Space>
        <Space size={4}>
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(field.id);
            }}
          />
        </Space>
      </div>
      {getSlotMeta(field) ? (
        <div className="builder-slot-panel">
          <div className="builder-slot-header">
            <div>
              <Typography.Text strong>{getSlotMeta(field)?.label}</Typography.Text>
              <div className="builder-slot-description">{getSlotMeta(field)?.description}</div>
            </div>
          </div>
          {field.children?.length ? (
            <div className="builder-field-children">
              {field.children.map((child, childIndex) => renderField(child, childIndex, level + 1))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该插槽下还没有字段" />
          )}
          {buildAddButton(field.id, '点击添加插槽字段')}
        </div>
      ) : null}
    </div>
  );

  return (
    <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        字段列表
      </Typography.Title>

      {fields.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先从左侧添加一个字段" /> : null}

      <div className="builder-field-list">
        {fields.map((field, index) => renderField(field, index))}
        {buildAddButton(undefined, '点击添加字段')}
      </div>
    </Card>
  );
}
