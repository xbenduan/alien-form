import * as RadixPopover from "@radix-ui/react-popover";
import * as RadixSelect from "@radix-ui/react-select";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "./cn";
import { extractText } from "./typography";

interface SelectOption {
  label?: ReactNode;
  value: string | number | boolean;
  disabled?: boolean;
}

const triggerClass =
  "ant-select ant-select-selector flex min-h-9 w-full items-center justify-between gap-1.5 rounded-[10px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3 text-sm text-[var(--af-text,#2f261f)] outline-none transition placeholder:text-[rgba(80,63,50,0.42)] focus:border-[rgba(201,100,66,0.45)] focus:ring-2 focus:ring-[rgba(201,100,66,0.08)] data-[disabled]:cursor-not-allowed data-[disabled]:bg-[rgba(241,234,226,0.8)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]";

const contentClass =
  "z-[1300] max-h-72 min-w-[var(--radix-popover-trigger-width,12rem)] overflow-auto rounded-[12px] border border-[rgba(120,98,79,0.14)] bg-[rgba(255,251,246,0.98)] p-1 shadow-[0_14px_32px_rgba(68,49,33,0.16)] backdrop-blur";

const itemClass =
  "flex cursor-pointer select-none items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition hover:bg-[rgba(201,100,66,0.08)] data-[highlighted]:bg-[rgba(201,100,66,0.08)] data-[state=checked]:bg-[rgba(201,100,66,0.12)] data-[state=checked]:text-[#A24E31] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55";

interface SelectProps {
  value?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange?: (value: any) => void;
  options?: SelectOption[];
  mode?: "multiple" | "tags";
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function Select(props: SelectProps) {
  if (props.mode === "tags") {
    return <TagsSelect {...props} />;
  }
  if (props.mode === "multiple") {
    return <MultipleSelect {...props} />;
  }
  return <SingleSelect {...props} />;
}

function ChevronIcon() {
  return (
    <svg
      className="ml-1 shrink-0 text-[rgba(80,63,50,0.55)]"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l6 6" />
      <path d="M9 3l-6 6" />
    </svg>
  );
}

function SingleSelect({
  value,
  onChange,
  options = [],
  allowClear,
  disabled,
  placeholder,
  style,
  className,
}: SelectProps) {
  const stringValue =
    value === undefined || value === null || value === "" ? undefined : String(value);

  const valueMap = useMemo(() => {
    const map = new Map<string, SelectOption>();
    for (const option of options) {
      map.set(String(option.value), option);
    }
    return map;
  }, [options]);

  const matched = stringValue !== undefined ? valueMap.get(stringValue) : undefined;

  return (
    <RadixSelect.Root
      value={stringValue}
      disabled={disabled}
      onValueChange={(nextValue) => {
        const matchedOption = valueMap.get(nextValue);
        onChange?.(matchedOption ? matchedOption.value : nextValue);
      }}
    >
      <div className="relative inline-flex w-full items-center">
        <RadixSelect.Trigger className={cn(triggerClass, className)} style={style}>
          <RadixSelect.Value placeholder={placeholder ?? "请选择"}>
            {matched ? (matched.label ?? String(matched.value)) : undefined}
          </RadixSelect.Value>
          <RadixSelect.Icon asChild>
            <ChevronIcon />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        {allowClear && stringValue !== undefined && !disabled ? (
          <button
            type="button"
            className="absolute right-8 inline-flex h-5 w-5 items-center justify-center rounded-full text-[rgba(80,63,50,0.55)] hover:bg-[rgba(201,100,66,0.08)] hover:text-[#A24E31]"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange?.(undefined);
            }}
          >
            <ClearIcon />
          </button>
        ) : null}
      </div>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className={contentClass}
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={String(option.value)}
                value={String(option.value)}
                disabled={option.disabled}
                className={itemClass}
              >
                <RadixSelect.ItemText>{option.label ?? String(option.value)}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function MultipleSelect({
  value,
  onChange,
  options = [],
  allowClear,
  disabled,
  placeholder,
  style,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => {
    if (!Array.isArray(value)) return [] as unknown[];
    return value;
  }, [value]);
  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);

  const toggleValue = (option: SelectOption) => {
    if (selectedSet.has(String(option.value))) {
      onChange?.(selected.filter((item) => String(item) !== String(option.value)));
    } else {
      onChange?.([...selected, option.value]);
    }
  };

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(triggerClass, "h-auto flex-wrap py-1", className)}
          style={style}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {selected.length === 0 ? (
              <span className="text-[rgba(80,63,50,0.42)]">{placeholder ?? "请选择"}</span>
            ) : (
              selected.map((item) => {
                const opt = options.find((option) => String(option.value) === String(item));
                return (
                  <span
                    key={String(item)}
                    className="inline-flex items-center gap-1 rounded-[7px] bg-[rgba(201,100,66,0.1)] px-1.5 py-0.5 text-xs text-[#A24E31]"
                  >
                    {opt?.label ?? String(item)}
                    {!disabled ? (
                      <span
                        role="button"
                        tabIndex={-1}
                        className="inline-flex h-3 w-3 cursor-pointer items-center justify-center text-[10px] hover:text-[#7A2E14]"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onChange?.(
                            selected.filter((current) => String(current) !== String(item)),
                          );
                        }}
                      >
                        ×
                      </span>
                    ) : null}
                  </span>
                );
              })
            )}
          </span>
          <span className="flex items-center gap-1">
            {allowClear && selected.length > 0 && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-[rgba(80,63,50,0.55)] hover:bg-[rgba(201,100,66,0.08)] hover:text-[#A24E31]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange?.([]);
                }}
              >
                <ClearIcon />
              </span>
            ) : null}
            <ChevronIcon />
          </span>
        </button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          sideOffset={6}
          className={contentClass}
        >
          {options.map((option) => {
            const isSelected = selectedSet.has(String(option.value));
            return (
              <button
                key={String(option.value)}
                type="button"
                disabled={option.disabled}
                className={cn(
                  itemClass,
                  "w-full justify-start text-left",
                  isSelected && "bg-[rgba(201,100,66,0.12)] text-[#A24E31]",
                )}
                onClick={() => toggleValue(option)}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[rgba(120,98,79,0.32)] bg-white">
                  {isSelected ? (
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
                  ) : null}
                </span>
                <span className="flex-1">{option.label ?? String(option.value)}</span>
              </button>
            );
          })}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

function TagsSelect({
  value,
  onChange,
  disabled,
  placeholder,
  style,
  className,
}: SelectProps) {
  const initial = Array.isArray(value) ? value.map(String).join(", ") : "";
  const [draft, setDraft] = useState(initial);
  const lastSyncedValue = useRef(initial);

  useEffect(() => {
    const next = Array.isArray(value) ? value.map(String).join(", ") : "";
    if (next !== lastSyncedValue.current) {
      lastSyncedValue.current = next;
      setDraft(next);
    }
  }, [value]);

  const commit = (raw: string) => {
    const tokens = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    lastSyncedValue.current = tokens.join(", ");
    onChange?.(tokens);
  };

  return (
    <input
      className={cn(triggerClass, "block", className)}
      style={style}
      disabled={disabled}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit((event.target as HTMLInputElement).value);
        }
      }}
    />
  );
}

export type { SelectOption };
export { extractText };
