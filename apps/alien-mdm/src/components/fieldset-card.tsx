import type { CSSProperties, ReactNode } from "react";
import { fieldGridItemStyle } from "@utils/field-grid";

export function FieldsetCard({
  title,
  description,
  gridSpan,
  children,
  style,
}: {
  title?: string;
  description?: string;
  gridSpan?: unknown;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <fieldset
      className="box-border col-span-[var(--alien-grid-item-span,24)] m-[4px_0_16px] w-full min-w-0 rounded-lg border border-dashed border-[#d8dee8] bg-[var(--app-surface,rgba(255,255,255,0.72))] p-[14px_16px_8px]"
      style={{ ...fieldGridItemStyle(gridSpan), ...style }}
    >
      {title ? (
        <legend className="m-0 table w-auto max-w-full border-0 px-1.5 text-sm font-medium leading-5 text-[#344054]">
          {title}
        </legend>
      ) : null}
      {description ? (
        <div className="-mt-0.5 mb-3 text-[13px] leading-5 text-[#8a94a6]">{description}</div>
      ) : null}
      <div className="min-w-0">{children}</div>
    </fieldset>
  );
}
