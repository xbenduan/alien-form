import { Label as RadixLabel } from "@radix-ui/react-label";
import {
  createContext,
  forwardRef,
  useContext,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

const FormContext = createContext<{ layout?: "horizontal" | "vertical" }>({ layout: "vertical" });

function FormItem({
  label,
  children,
  required,
  extra,
  right,
}: {
  label?: ReactNode;
  children?: ReactNode;
  required?: boolean;
  extra?: ReactNode;
  right?: ReactNode;
}) {
  const { layout } = useContext(FormContext);
  return (
    <div className="ant-form-item mb-3">
      {label ? (
        <div className="flex items-center justify-between mb-1.5">
          <RadixLabel
            className={cn(
              "text-sm font-medium text-[rgba(47,38,31,0.88)]",
              layout === "horizontal" && "mb-1",
            )}
          >
            {required ? <span className="mr-1 text-[#C96442]">*</span> : null}
            {label}
          </RadixLabel>
          {right ? <div className="flex items-center">{right}</div> : null}
        </div>
      ) : null}
      <div className="ant-form-item-control">{children}</div>
      {extra ? <div className="mt-1 text-xs text-[rgba(80,63,50,0.62)]">{extra}</div> : null}
    </div>
  );
}

function FormRoot({
  children,
  layout = "vertical",
  className,
}: {
  children?: ReactNode;
  layout?: "horizontal" | "vertical";
  size?: "small" | "middle" | "large";
  className?: string;
}) {
  return (
    <FormContext.Provider value={{ layout }}>
      <div className={cn("ant-form", className)}>{children}</div>
    </FormContext.Provider>
  );
}

export const Form = Object.assign(FormRoot, { Item: FormItem });

const inputClass =
  "ant-input min-h-9 w-full rounded-[10px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3 text-sm text-[var(--af-text,#2f261f)] outline-none transition placeholder:text-[rgba(80,63,50,0.42)] focus:border-[rgba(201,100,66,0.45)] focus:ring-2 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]";

type ChangeEventLike = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  value?: string | number;
  onChange?: (event: ChangeEventLike) => void;
  className?: string;
  style?: CSSProperties;
}

const InputComponent = forwardRef<HTMLInputElement, InputProps>(function InputComponent(
  { className, style, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} style={style} {...props} />;
});

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value?: string | number;
  onChange?: (event: ChangeEventLike) => void;
  autoSize?: { minRows?: number; maxRows?: number } | boolean;
  className?: string;
  style?: CSSProperties;
}

const InputTextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function InputTextArea(
  { className, style, autoSize, rows: rowsFromProps, ...props },
  ref,
) {
  const rows = rowsFromProps ?? (typeof autoSize === "object" ? (autoSize.minRows ?? 3) : 3);
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "ant-input min-h-20 w-full rounded-[10px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3 py-2 text-sm text-[var(--af-text,#2f261f)] outline-none transition placeholder:text-[rgba(80,63,50,0.42)] focus:border-[rgba(201,100,66,0.45)] focus:ring-2 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
        className,
      )}
      style={style}
      {...props}
    />
  );
});

export const Input = Object.assign(InputComponent, { TextArea: InputTextArea });

export function InputNumber({
  value,
  onChange,
  className,
  style,
  min,
  max,
  ...props
}: {
  value?: number | null;
  onChange?: (value: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      className={cn("ant-input-number", inputClass, className)}
      style={style}
      value={value ?? ""}
      min={min}
      max={max}
      onChange={(event) => {
        const nextValue = event.target.value;
        onChange?.(nextValue === "" ? null : Number(nextValue));
      }}
      {...props}
    />
  );
}

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value === "object" && value !== null) {
    if (
      "format" in value &&
      typeof (value as { format?: (mask?: string) => string }).format === "function"
    ) {
      return (value as { format: (mask?: string) => string }).format("YYYY-MM-DD");
    }
    if ("$d" in value && (value as { $d?: Date | string }).$d) {
      return new Date((value as { $d: Date | string }).$d).toISOString().slice(0, 10);
    }
  }
  return "";
}

export function DatePicker({
  value,
  onChange,
  disabled,
  placeholder,
  style,
  className,
}: {
  value?: unknown;
  onChange?: (value: unknown, dateString: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <input
      type="date"
      className={cn("ant-picker", inputClass, className)}
      style={style}
      disabled={disabled}
      placeholder={placeholder}
      value={normalizeDateValue(value)}
      onChange={(event) => onChange?.(event.target.value, event.target.value)}
    />
  );
}

export { inputClass };
