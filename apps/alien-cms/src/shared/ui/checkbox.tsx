import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Label as RadixLabel } from "@radix-ui/react-label";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn";

interface CheckboxBaseProps {
  checked?: boolean;
  onChange?: (event: { target: { checked: boolean; value?: unknown } }) => void;
  children?: ReactNode;
  value?: unknown;
  disabled?: boolean;
  className?: string;
}

function CheckboxBase({
  checked,
  onChange,
  children,
  value,
  disabled,
  className,
}: CheckboxBaseProps) {
  return (
    <RadixLabel
      className={cn(
        "ant-checkbox-wrapper inline-flex items-center gap-1.5 text-sm text-[var(--af-text,#2f261f)]",
        disabled && "opacity-55",
        className,
      )}
    >
      <RadixCheckbox.Root
        checked={!!checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange?.({ target: { checked: !!next, value } })}
        className={cn(
          "ant-checkbox flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-[rgba(120,98,79,0.32)] bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,100,66,0.3)]",
          "data-[state=checked]:border-[var(--af-primary,#C96442)] data-[state=checked]:bg-[var(--af-primary,#C96442)] data-[state=checked]:text-white",
          "data-[disabled]:cursor-not-allowed",
        )}
      >
        <RadixCheckbox.Indicator className="flex items-center justify-center">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1.6 5.2 4 7.6 8.4 2.4" />
          </svg>
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {children ? <span>{children}</span> : null}
    </RadixLabel>
  );
}

function CheckboxGroup({
  value = [],
  onChange,
  options,
  disabled,
  children,
  className,
  style,
}: {
  value?: unknown[];
  onChange?: (value: unknown[]) => void;
  options?: Array<{ label?: ReactNode; value: unknown; disabled?: boolean }>;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const selected = new Set(value ?? []);

  if (options?.length) {
    return (
      <div className={cn("ant-checkbox-group flex flex-wrap gap-2.5", className)} style={style}>
        {options.map((option) => (
          <CheckboxBase
            key={String(option.value)}
            value={option.value}
            checked={selected.has(option.value)}
            disabled={disabled || option.disabled}
            onChange={({ target }) => {
              const next = new Set(value ?? []);
              if (target.checked) {
                next.add(option.value);
              } else {
                next.delete(option.value);
              }
              onChange?.(Array.from(next));
            }}
          >
            {option.label}
          </CheckboxBase>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("ant-checkbox-group", className)} style={style}>
      {children}
    </div>
  );
}

function CheckboxComponent(props: CheckboxBaseProps) {
  return <CheckboxBase {...props} />;
}

export const Checkbox = Object.assign(CheckboxComponent, { Group: CheckboxGroup });
