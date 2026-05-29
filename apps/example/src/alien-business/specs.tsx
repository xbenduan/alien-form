import type React from "react";
import { useArrayRows, useRenderField, type IField } from "@alien-form/react";

/**
 * Specs — 规格定义列表组件
 *
 * 每张卡片：左侧固定宽度的规格名输入框，右侧上移/下移/删除按钮。
 * 下方是规格值列表。
 */
export const Specs: React.FC<{
  field: IField;
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  disabled?: boolean;
  addText?: string;
}> = ({
  field,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
  addText = "+ 添加规格维度",
}) => {
  const renderField = useRenderField();
  const specsCount = useArrayRows(field);

  return (
    <div className="space-y-4">
      {specsCount === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          暂无规格定义，点击下方按钮添加。
        </div>
      )}

      {Array.from({ length: specsCount }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* 头部：规格名（固定宽度） + 操作按钮 */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <div className="w-48 shrink-0">
              {renderField([field.path, i, "name"], { decorator: false })}
            </div>
            {!disabled && (
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMoveUp(i)}
                  disabled={i === 0}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                  title="上移"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(i)}
                  disabled={i === specsCount - 1}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                  title="下移"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="删除此规格维度"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* 规格值列表 */}
          <div className="p-4">
            {renderField([field.path, i, "values"], { decoratorProps: { label: "" } })}
          </div>
        </div>
      ))}

      {/* 添加规格按钮 */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onAdd()}
          className="w-full rounded-lg border border-dashed border-border/60 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          {addText}
        </button>
      )}
    </div>
  );
};
