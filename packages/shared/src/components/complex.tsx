import { useState } from "react";
import { ProfileOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Tooltip } from "antd";
import type { FieldComponentProps } from "../types";
import { useFieldMode } from "./field-mode";
import { FieldDetailModal } from "./FieldDetailModal";
import { toDisplayText } from "../utils/schema";

/** table 单元格中复杂字段的通用外观：摘要文本 + 详情按钮 + 详情弹窗。 */
function TableComplexCell({
  value,
  schema,
  title,
}: {
  value: unknown;
  schema?: FieldComponentProps["schema"];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="af-table-complex">
      <span className="af-table-complex-summary">{toDisplayText(value)}</span>
      <Tooltip title={`查看${title ?? ""}详情`}>
        <Button
          type="link"
          size="small"
          icon={<ProfileOutlined />}
          aria-label={`查看${title ?? ""}详情`}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <FieldDetailModal
        open={open}
        title={title}
        field={schema}
        value={value}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

/**
 * 对象字段容器：
 *  - isTable：折叠为摘要 + 详情按钮
 *  - form/detail：由 @alien-form/react 注入 children，直接渲染子字段
 */
export function ObjectField(props: FieldComponentProps) {
  if (props.isTable) {
    return <TableComplexCell value={props.value} schema={props.schema} title={props.title} />;
  }
  return <div className="af-object-field">{props.children}</div>;
}

/**
 * 对象数组卡片容器：
 *  - isTable：折叠为摘要 + 详情按钮
 *  - form：逐行渲染 + 增删按钮
 *  - detail：只读逐行渲染
 */
export function ArrayCards(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);

  if (props.isTable) {
    return <TableComplexCell value={props.value} schema={props.schema} title={props.title} />;
  }

  const rows = props.rows ?? [];
  const readonly = mode === "detail";

  if (rows.length === 0) {
    return (
      <div className="af-array-cards af-array-cards-empty">
        <Empty description="暂无数据" style={{ paddingBlock: 16 }} />
        {readonly ? null : (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => props.onAdd?.()}>
            添加一行
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="af-array-cards">
      {rows.map((row, index) => (
        <div className="af-array-card" key={props.rowNodes?.[index]?.id ?? index}>
          <div className="af-array-card-header">
            <span className="af-array-card-index">#{index + 1}</span>
            {readonly ? null : (
              <Button danger size="small" onClick={() => props.onRemove?.(index)}>
                删除
              </Button>
            )}
          </div>
          <div className="af-array-card-body">{row}</div>
        </div>
      ))}
      {readonly ? null : (
        <Button
          className="af-array-card-add"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => props.onAdd?.()}
        >
          添加一行
        </Button>
      )}
    </div>
  );
}
