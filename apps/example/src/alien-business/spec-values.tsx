import type React from "react";
import { useArrayRows, useRenderField, type IField } from "@alien-form/react";

/**
 * SpecValues — 规格值网格组件
 *
 * 每个规格值：输入框 + 紧跟的正方形删除按钮，尺寸一致。
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
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: valuesCount }, (_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="w-24">
            {renderField([field.path, i, "label"], { decorator: false })}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              title="删除"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {/* 添加规格值按钮，与输入框等高 */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onAdd({ label: "" })}
          className="flex h-9 items-center justify-center rounded-md border border-dashed border-border/60 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          +
        </button>
      )}
    </div>
  );
};
