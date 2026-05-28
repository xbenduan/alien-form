import type React from "react";
import { define, type Resolved } from "@alien-form/react";
import { Input } from "@alien-form/ui";

const imageInputSchema = define({
  type: "string",
  props: {
    placeholder: "",
    className: "",
  },
});

export const ImageInput: React.FC<Resolved<typeof imageInputSchema>> = ({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}) => {
  const imageUrl = value ?? "";

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {imageUrl ? (
            <img src={imageUrl} alt="规格图片预览" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-muted-foreground">无图片</span>
          )}
        </div>
        <div className="flex-1">
          <Input
            value={imageUrl}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            仅在当前规格开启图片模式时参与 SKU 分组展示。
          </p>
        </div>
      </div>
    </div>
  );
};
