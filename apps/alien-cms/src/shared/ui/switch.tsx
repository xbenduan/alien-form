import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "./cn";

export function Switch({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onChange?.(value)}
      className={cn(
        "ant-switch relative inline-flex h-6 w-10 items-center rounded-[9px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,100,66,0.3)]",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-[var(--af-primary,#C96442)]",
        "data-[state=unchecked]:border-[rgba(120,98,79,0.18)] data-[state=unchecked]:bg-[rgba(120,98,79,0.12)]",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          "block h-4 w-4 rounded-[6px] bg-white shadow transition-transform",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-1",
        )}
      />
    </RadixSwitch.Root>
  );
}
