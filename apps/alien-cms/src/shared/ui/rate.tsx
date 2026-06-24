import { cn } from "./cn";

export function Rate({
  value = 0,
  onChange,
  disabled,
  className,
}: {
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("ant-rate inline-flex gap-1", className)}>
      {Array.from({ length: 5 }).map((_, index) => {
        const active = index < value;
        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            className={cn(
              "text-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,100,66,0.35)]",
              active ? "text-[#C96442]" : "text-[rgba(120,98,79,0.25)]",
              disabled && "cursor-not-allowed",
            )}
            onClick={() => onChange?.(index + 1)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
