import type React from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty } from "antd";
import { defineAdapter } from "../adapter";

interface ArrayCardsProps {
  rows: React.ReactNode[];
  rowNodes?: Array<{ id?: string }>;
  onAdd: (initialValues?: unknown) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  addText?: string;
}

function ArrayCards({
  rows,
  rowNodes,
  onAdd,
  onRemove,
  disabled,
  addText = "添加一行",
}: ArrayCardsProps) {
  const addIcon = addText.trimStart().startsWith("+") ? undefined : <PlusOutlined />;

  if (rows.length === 0) {
    return (
      <div className="schema-array-cards schema-array-cards-empty">
        <Empty description="暂无数据" style={{ paddingBlock: 20 }} />
        {!disabled ? (
          <Button type="dashed" icon={addIcon} onClick={() => onAdd()}>
            {addText}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="schema-array-cards">
      {rows.map((row, index) => (
        <div className="schema-array-card" key={rowNodes?.[index]?.id ?? index}>
          <div className="schema-array-card-header">
            <span className="schema-array-card-index">#{index + 1}</span>
            {!disabled ? (
              <Button danger size="small" onClick={() => onRemove(index)}>
                删除
              </Button>
            ) : null}
          </div>
          <div className="schema-array-card-content">{row}</div>
        </div>
      ))}
      {!disabled ? (
        <Button
          className="schema-array-card-add"
          type="dashed"
          icon={addIcon}
          onClick={() => onAdd()}
        >
          {addText}
        </Button>
      ) : null}
    </div>
  );
}

export default defineAdapter(ArrayCards, {
  key: "ArrayCards",
  label: "ArrayCards",
  description: "对象数组卡片编辑组件。",
  kind: "component",
  scenes: { form: {}, detail: { mode: "readonly", props: { disabled: true } } },
  meta: { fieldType: "array" },
});
