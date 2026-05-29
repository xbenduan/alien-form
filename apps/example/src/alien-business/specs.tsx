import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useForm, useRenderField, type IField } from "@alien-form/react";
import { Input, Switch } from "@alien-form/ui";

// ─── SpecValueItem ──────────────────────────────────────────────────────────
// 单个规格值卡片，自管理对 field 的读写，避免父组件 render 中访问 field signal

const SpecValueItem: React.FC<{
  specPath: string;
  valIdx: number;
  supportsImage: boolean;
  disabled?: boolean;
  onRemove: () => void;
}> = ({ specPath, valIdx, supportsImage, disabled, onRemove }) => {
  const form = useForm();
  const [label, setLabel] = useState("");
  const [image, setImage] = useState("");

  const labelPath = `${specPath}.values.${valIdx}.label`;
  const imagePath = `${specPath}.values.${valIdx}.image`;

  // 初始化 + 监听 field 变化
  useEffect(() => {
    const lf = form.getField(labelPath);
    if (lf) setLabel(lf.value ?? "");
    const unsub = lf?.subscribe(() => setLabel(lf.value ?? ""));
    return unsub;
  }, [form, labelPath]);

  useEffect(() => {
    if (!supportsImage) return;
    const imf = form.getField(imagePath);
    if (imf) setImage(imf.value ?? "");
    const unsub = imf?.subscribe(() => setImage(imf.value ?? ""));
    return unsub;
  }, [form, imagePath, supportsImage]);

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLabel(val);
      form.getField(labelPath)?.setValue(val);
    },
    [form, labelPath],
  );

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setImage(val);
      form.getField(imagePath)?.setValue(val);
    },
    [form, imagePath],
  );

  return (
    <div className="group flex items-start gap-2 rounded-lg border p-2">
      {/* 若支持图片则显示图片上传区域 */}
      {supportsImage && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
          {image ? (
            <img
              src={image}
              alt={label || "规格图片"}
              className="h-full w-full object-cover"
            />
          ) : (
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
          )}
        </div>
      )}

      {/* 规格值输入 */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Input
          className="h-7 text-xs"
          placeholder="规格值"
          value={label}
          onChange={handleLabelChange}
          disabled={disabled}
        />
        {supportsImage && (
          <Input
            className="h-7 text-xs"
            placeholder="图片 URL"
            value={image}
            onChange={handleImageChange}
            disabled={disabled}
          />
        )}
      </div>

      {/* 删除按钮 */}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
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
  );
};

// ─── SpecCard ───────────────────────────────────────────────────────────────
// 单个规格维度的卡片

const SpecCard: React.FC<{
  specPath: string;
  specIdx: number;
  disabled?: boolean;
  onRemoveSpec: () => void;
}> = ({ specPath, specIdx, disabled, onRemoveSpec }) => {
  const form = useForm();
  const [name, setName] = useState("");
  const [supportsImage, setSupportsImage] = useState(false);
  const [valuesCount, setValuesCount] = useState(0);

  const namePath = `${specPath}.name`;
  const siPath = `${specPath}.supportsImage`;
  const valuesPath = `${specPath}.values`;

  // 监听 name field
  useEffect(() => {
    const f = form.getField(namePath);
    if (f) setName(f.value ?? "");
    const unsub = f?.subscribe(() => setName(f.value ?? ""));
    return unsub;
  }, [form, namePath]);

  // 监听 supportsImage field
  useEffect(() => {
    const f = form.getField(siPath);
    if (f) setSupportsImage(!!f.value);
    const unsub = f?.subscribe(() => setSupportsImage(!!f.value));
    return unsub;
  }, [form, siPath]);

  // 监听 values field 的数组长度
  useEffect(() => {
    const f = form.getField(valuesPath);
    if (f) {
      const arr = Array.isArray(f.value) ? f.value : [];
      setValuesCount(arr.length);
    }
    const unsub = f?.subscribe(() => {
      const arr = Array.isArray(f!.value) ? f!.value : [];
      setValuesCount(arr.length);
    });
    return unsub;
  }, [form, valuesPath]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setName(val);
      form.getField(namePath)?.setValue(val);
    },
    [form, namePath],
  );

  const handleSupportsImageChange = useCallback(
    (val: boolean) => {
      setSupportsImage(val);
      form.getField(siPath)?.setValue(val);
    },
    [form, siPath],
  );

  const handleAddValue = useCallback(() => {
    const f = form.getField(valuesPath);
    f?.push({ label: "", image: "" });
  }, [form, valuesPath]);

  const handleRemoveValue = useCallback(
    (valIdx: number) => {
      const f = form.getField(valuesPath);
      f?.remove(valIdx);
    },
    [form, valuesPath],
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* ── 上半部分：规格名 + 是否支持图片 ── */}
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <div className="flex-1">
          <Input
            placeholder="例如：颜色、内存、运行内存"
            value={name}
            onChange={handleNameChange}
            disabled={disabled}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-muted-foreground">支持图片</span>
          <Switch
            value={supportsImage}
            onChange={handleSupportsImageChange}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── 下半部分：规格值（行内排列，每行四个）── */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: valuesCount }, (_, valIdx) => (
            <SpecValueItem
              key={valIdx}
              specPath={specPath}
              valIdx={valIdx}
              supportsImage={supportsImage}
              disabled={disabled}
              onRemove={() => handleRemoveValue(valIdx)}
            />
          ))}

          {/* 添加规格值按钮，永远在最后排列 */}
          {!disabled && (
            <button
              type="button"
              onClick={handleAddValue}
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
      </div>

      {/* 删除规格按钮 */}
      {!disabled && (
        <div className="flex justify-end border-t px-4 py-2">
          <button
            type="button"
            onClick={onRemoveSpec}
            className="text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            删除此规格维度
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Specs (主组件) ─────────────────────────────────────────────────────────

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
  const [specsCount, setSpecsCount] = useState(0);

  // 只追踪数组长度变化，不在 render 里读取嵌套 field signals
  useEffect(() => {
    const arr = Array.isArray(field.value) ? field.value : [];
    setSpecsCount(arr.length);
    return field.subscribe(() => {
      const arr = Array.isArray(field.value) ? field.value : [];
      setSpecsCount(arr.length);
    });
  }, [field]);

  return (
    <div className="space-y-4">
      {specsCount === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          暂无规格定义，点击下方按钮添加。
        </div>
      )}

      {Array.from({ length: specsCount }, (_, specIdx) => (
        <SpecCard
          key={specIdx}
          specPath={`${field.path}.${specIdx}`}
          specIdx={specIdx}
          disabled={disabled}
          onRemoveSpec={() => onRemove?.(specIdx)}
        />
      ))}

      {/* 添加规格按钮 */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onAdd?.()}
          className="w-full rounded-lg border border-dashed border-border/60 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          {addText}
        </button>
      )}
    </div>
  );
};
