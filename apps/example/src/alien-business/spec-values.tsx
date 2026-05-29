import type React from "react";
import { useEffect, useState } from "react";
import { useField, useRenderField, type IField } from "@alien-form/react";

/**
 * SpecValues — 规格值网格组件
 *
 * 只负责网格布局，不渲染任何 UI 控件。
 * 每个规格值的 label 和 image 字段由 schema 声明 component，
 * 通过 renderField 放到网格卡片的正确位置。
 *
 * 根据同级 supportsImage 字段的值决定是否显示图片区域。
 */
export const SpecValues: React.FC<{
  field: IField;
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}> = ({ field, onAdd, onRemove, disabled }) => {
  const renderField = useRenderField();
  const [valuesCount, setValuesCount] = useState(0);

  // 监听数组长度
  useEffect(() => {
    const arr = Array.isArray(field.value) ? field.value : [];
    setValuesCount(arr.length);
    return field.subscribe(() => {
      const arr = Array.isArray(field.value) ? field.value : [];
      setValuesCount(arr.length);
    });
  }, [field]);

  // 读取同级 supportsImage 的值
  const specPath = field.path.replace(/\.values$/, "");
  const supportsImageField = useField(`${specPath}.supportsImage`);
  const supportsImage = !!supportsImageField?.value;

  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: valuesCount }, (_, i) => (
        <div key={i} className="group flex items-start gap-2 rounded-lg border p-2">
          {/* 图片预览区域 */}
          {supportsImage && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
              <svg
                className="h-5 w-5 text-muted-foreground/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
          )}

          {/* 规格值字段 */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {renderField([field.path, i, "label"])}
            {supportsImage && renderField([field.path, i, "image"])}
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
          onClick={() => onAdd({ label: "", image: "" })}
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
