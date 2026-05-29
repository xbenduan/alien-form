import type React from "react";
import { useArrayRows, useRenderField, type IField } from "@alien-form/react";

/**
 * Specs — 规格定义列表组件
 *
 * 只负责卡片布局编排，不渲染任何 UI 控件。
 * 所有子字段（name、supportsImage、values）的渲染由 schema 声明的 component 决定，
 * 通过 renderField 放到正确位置。
 */
export const Specs: React.FC<{
  field: IField;
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  addText?: string;
}> = ({
  field,
  onAdd,
  onRemove,
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
          {/* 上半部分：规格名 + 是否支持图片 */}
          <div className="flex items-center gap-4 border-b px-4 py-3">
            <div className="flex-1">
              {renderField([field.path, i, "name"])}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm text-muted-foreground">支持图片</span>
              {renderField([field.path, i, "supportsImage"])}
            </div>
          </div>

          {/* 下半部分：规格值列表（由 SpecValues 组件渲染） */}
          <div className="p-4">
            {renderField([field.path, i, "values"])}
          </div>

          {/* 删除规格按钮 */}
          {!disabled && (
            <div className="flex justify-end border-t px-4 py-2">
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                删除此规格维度
              </button>
            </div>
          )}
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
