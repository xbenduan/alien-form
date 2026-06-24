import * as RadixRadio from "@radix-ui/react-radio-group";
import { Label as RadixLabel } from "@radix-ui/react-label";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";

interface RadioOptionProps {
  value?: unknown;
  disabled?: boolean;
  children?: ReactNode;
}

function RadioOption({ value, disabled, children }: RadioOptionProps) {
  return (
    <RadixLabel
      className={cn(
        "ant-radio-wrapper inline-flex items-center gap-1.5 text-sm text-[var(--af-text,#2f261f)]",
        disabled && "opacity-55",
      )}
    >
      <RadixRadio.Item
        value={String(value)}
        disabled={disabled}
        className={cn(
          "ant-radio flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[rgba(120,98,79,0.32)] bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,100,66,0.3)]",
          "data-[state=checked]:border-[var(--af-primary,#C96442)]",
        )}
      >
        <RadixRadio.Indicator className="block h-2 w-2 rounded-full bg-[var(--af-primary,#C96442)]" />
      </RadixRadio.Item>
      {children ? <span>{children}</span> : null}
    </RadixLabel>
  );
}

function RadioGroup({
  value,
  onChange,
  disabled,
  children,
}: {
  value?: unknown;
  onChange?: (event: { target: { value: unknown } }) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const stringValue = value === undefined || value === null ? undefined : String(value);

  // Build a lookup so we can convert back to original (non-string) values when an option fires.
  const valueMap = new Map<string, unknown>();
  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const optionValue = (child as ReactElement<{ value?: unknown }>).props.value;
      if (optionValue !== undefined) {
        valueMap.set(String(optionValue), optionValue);
      }
    }
  });

  return (
    <RadixRadio.Root
      value={stringValue}
      disabled={disabled}
      onValueChange={(nextValue) => {
        const original = valueMap.has(nextValue) ? valueMap.get(nextValue) : nextValue;
        onChange?.({ target: { value: original } });
      }}
      className="ant-radio-group flex flex-wrap gap-2.5"
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return cloneElement(child as ReactElement<RadioOptionProps>, {
          disabled: disabled || (child as ReactElement<RadioOptionProps>).props.disabled,
        });
      })}
    </RadixRadio.Root>
  );
}

function RadioComponent(props: RadioOptionProps) {
  return <RadioOption {...props} />;
}

export const Radio = Object.assign(RadioComponent, { Group: RadioGroup });
