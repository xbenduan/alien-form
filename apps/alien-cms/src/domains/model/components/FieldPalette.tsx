import type { BuilderComponentName, BuilderFieldType } from '@alien-form/cms';
import { Button, Card, Space, Typography } from "../../../shared/ui";

export interface FieldPreset {
  key: string;
  label: string;
  type: BuilderFieldType;
  component: BuilderComponentName;
}

export const fieldPresets: FieldPreset[] = [
  { key: 'input', label: '文本输入', type: 'string', component: 'Input' },
  { key: 'textarea', label: '多行文本', type: 'string', component: 'Textarea' },
  { key: 'number', label: '数字输入', type: 'number', component: 'NumberInput' },
  { key: 'select', label: '下拉选择', type: 'string', component: 'Select' },
  { key: 'switch', label: '布尔开关', type: 'boolean', component: 'Switch' },
  { key: 'date', label: '日期', type: 'string', component: 'DateInput' },
  { key: 'tags', label: '标签数组', type: 'tags', component: 'TagsInput' },
  { key: 'array-cards', label: '对象数组', type: 'array', component: 'ArrayCards' },
  { key: 'object', label: '对象分组', type: 'object', component: 'SectionCard' },
  { key: 'void', label: '布局分组', type: 'void', component: 'SectionCard' },
];

interface FieldPaletteProps {
  onAddField: (preset: FieldPreset) => void;
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          字段组件
        </Typography.Title>
        <Typography.Text type="secondary">
          先添加顶层字段，再在右侧配置字段 key、props、投影和 handlers。
        </Typography.Text>
        <div className="builder-palette-grid">
          {fieldPresets.map((preset) => (
            <Button key={preset.key} block onClick={() => onAddField(preset)}>
              {preset.label}
            </Button>
          ))}
        </div>
      </Space>
    </Card>
  );
}
