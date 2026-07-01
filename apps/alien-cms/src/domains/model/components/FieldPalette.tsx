import type { BuilderComponentName, BuilderFieldType } from "@alien-form/cms";
import { PlusOutlined } from "../../../shared/ui";
import { Button, Card, Tooltip, Typography } from "../../../shared/ui";

export interface FieldPreset {
  key: string;
  label: string;
  type: BuilderFieldType;
  component: BuilderComponentName;
}

export const fieldPresets: FieldPreset[] = [
  { key: "input", label: "文本输入", type: "string", component: "Input" },
  { key: "textarea", label: "多行文本", type: "string", component: "Textarea" },
  { key: "number", label: "数字输入", type: "number", component: "NumberInput" },
  { key: "select", label: "下拉选择", type: "string", component: "Select" },
  { key: "switch", label: "布尔开关", type: "boolean", component: "Switch" },
  { key: "date", label: "日期", type: "string", component: "DateInput" },
  { key: "tags", label: "标签数组", type: "tags", component: "TagsInput" },
  { key: "array-cards", label: "对象数组", type: "array", component: "ArrayCards" },
  { key: "object", label: "对象分组", type: "object", component: "SectionCard" },
  { key: "void", label: "布局分组", type: "void", component: "SectionCard" },
];

interface FieldPaletteProps {
  onAddField: (preset: FieldPreset) => void;
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <Card
      className="builder-palette-card model-query-card"
      title="添加字段"
      styles={{ body: { padding: 8 } }}
    >
      <ul className="builder-palette-list">
        {fieldPresets.map((preset) => (
          <li key={preset.key} className="builder-palette-item">
            <div className="builder-palette-item-meta">
              <Typography.Text strong>{preset.label}</Typography.Text>
              <span className="builder-palette-item-hint">{preset.component}</span>
            </div>
            <Tooltip title="添加到字段列表">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                aria-label={`添加 ${preset.label}`}
                onClick={() => onAddField(preset)}
              />
            </Tooltip>
          </li>
        ))}
      </ul>
    </Card>
  );
}
