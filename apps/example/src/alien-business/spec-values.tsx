import type React from "react";
import { useArrayRows, useRenderField, type IField } from "@alien-form/react";

/**
 * SpecValues — 规格值网格组件
 *
 * 每个规格值就是一个裸输入框，不包裹 FormItem。
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
        <div key={i} className="group relative">
          <div className="w-28">
            {renderField([field.path, i, "label"], { decorator: false })}
          </div>
          {/* 删除按钮，悬停显示 */}
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
              title="删除"
            >
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
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
          className="flex h-9 w-28 items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          +
        </button>
      )}
    </div>
  );
};
