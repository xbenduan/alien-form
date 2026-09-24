import type { ReactNode } from "react";
import { fieldGridItemStyle } from "@utils/field-grid";

export function FormItem({
  title,
  required,
  errors,
  description,
  mode,
  gridSpan,
  fieldPath,
  children,
}: {
  title?: string;
  required?: boolean;
  errors?: Array<{ message?: string }>;
  description?: string;
  mode?: string;
  gridSpan?: unknown;
  fieldPath?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="col-span-[var(--alien-grid-item-span,var(--alien-grid-default-span,24))] mb-2 min-w-0 max-[640px]:col-span-full"
      style={fieldGridItemStyle(gridSpan)}
      data-alien-form-field={fieldPath}
      tabIndex={fieldPath ? -1 : undefined}
    >
      {title ? (
        <label
          className={`mb-2 inline-flex items-center text-sm leading-[22px] ${mode === "detail" ? "text-[#8c8c8c]" : "text-[#262626]"}${required ? " before:mr-1 before:font-[SimSun,sans-serif] before:text-sm before:leading-none before:text-[#ff4d4f] before:content-['*']" : ""}`}
        >
          {title}
        </label>
      ) : null}
      <div className="min-w-0">{children}</div>
      {description ? (
        <div className="mt-1.5 text-sm leading-5 text-[#8c8c8c]">{description}</div>
      ) : null}
      {errors?.[0]?.message ? (
        <div className="mt-1.5 text-sm leading-5 text-[#ff4d4f]" role="alert">
          {errors[0].message}
        </div>
      ) : null}
    </div>
  );
}
