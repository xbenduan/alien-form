import type React from "react";
import { useArrayRows, useRenderField, type IField } from "@alien-form/react";

/**
 * SpecValues — 规格值网格组件
 *
 * 输入框、添加按钮同宽同高；删除按钮正方形等高，垃圾桶 icon。
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
          <div className="w-32">
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {/* 添加按钮，与输入框同宽同高 */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onAdd({ label: "" })}
          className="flex h-9 w-32 items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          +
        </button>
      )}
    </div>
  );
};
