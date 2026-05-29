import type React from "react";
import { useArrayRows, useRenderField, type IField } from "@alien-form/react";

/**
 * SpecValues — 规格值网格组件
 *
 * 只负责网格布局，不渲染任何 UI 控件。
 * 每个规格值的 label 字段由 schema 声明 component，
 * 通过 renderField 放到网格卡片的正确位置。
 */
export const SpecValues: React.FC<{
  field: IField;
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}> = ({ field, onAdd, onRemove, disabled }) => {
  const renderField = useRenderField();
  const valuesCount = useArrayRows(field);

  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: valuesCount }, (_, i) => (
        <div key={i} className="group flex items-center gap-2 rounded-lg border p-2">
          {/* 规格值字段 */}
          <div className="flex-1 min-w-0">
            {renderField([field.path, i, "label"], { decoratorProps: { label: "", className: "mb-0" } })}
          </div>

          {/* 删除按钮 */}
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              title="删除此规格值"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      ))}

      {/* 添加规格值按钮 */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onAdd({ label: "" })}
          className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-border/60 p-2 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          + 规格值
        </button>
      )}
    </div>
  );
};
