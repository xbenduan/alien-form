import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,100,66,0.3)] disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(120,98,79,0.18)] bg-white/85 text-[var(--af-text,#2f261f)] hover:border-[rgba(201,100,66,0.35)] hover:text-[#A24E31]",
        primary:
          "border-transparent bg-[var(--af-primary,#C96442)] text-white shadow-[0_8px_18px_rgba(201,100,66,0.16)] hover:brightness-95",
        dashed:
          "border-dashed border-[rgba(120,98,79,0.22)] bg-[rgba(248,243,236,0.78)] text-[var(--af-text,#2f261f)] hover:border-[rgba(201,100,66,0.38)]",
        link:
          "border-transparent bg-transparent px-0 text-[var(--af-primary,#C96442)] shadow-none hover:text-[#a24e31]",
        text:
          "border-transparent bg-transparent text-[var(--af-text,#2f261f)] shadow-none hover:bg-[rgba(201,100,66,0.08)]",
      },
      size: {
        small: "min-h-7 px-2.5 text-xs",
        middle: "min-h-9 px-3 text-sm",
        large: "min-h-[38px] px-4 text-sm",
      },
      block: {
        true: "flex w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "middle",
      block: false,
    },
  },
);

type AntButtonVariant = "default" | "primary" | "dashed" | "link" | "text";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLElement>, "type">,
    Omit<VariantProps<typeof buttonVariants>, "variant" | "block"> {
  type?: AntButtonVariant;
  danger?: boolean;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  href?: string;
  target?: string;
  rel?: string;
  htmlType?: "button" | "submit" | "reset";
  asChild?: boolean;
}

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(
  {
    children,
    className,
    type = "default",
    size = "middle",
    danger,
    block,
    loading,
    icon,
    disabled,
    href,
    target,
    rel,
    htmlType = "button",
    onClick,
    style,
    asChild,
    ...rest
  },
  ref,
) {
  const variantClass = buttonVariants({ variant: type, size, block: !!block });
  const dangerClass = cn(
    danger && type !== "primary" && "text-[#A24E31] hover:border-[rgba(201,100,66,0.35)]",
    danger && type === "primary" && "bg-[#A24E31]",
  );
  const baseClassName = cn(
    "ant-btn",
    type === "primary" && "ant-btn-primary",
    type === "link" && "ant-btn-link",
    type === "text" && "ant-btn-text",
    variantClass,
    dangerClass,
    (disabled || loading) && "cursor-not-allowed",
    className,
  );

  const content = (
    <>
      {icon ? (
        <span className="ant-btn-icon inline-flex items-center text-[1.05em]">{icon}</span>
      ) : null}
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : null}
      {children ? <span>{children}</span> : null}
    </>
  );

  if (asChild) {
    return (
      <Slot
        ref={ref as never}
        className={baseClassName}
        style={style as CSSProperties}
        onClick={disabled ? undefined : (onClick as never)}
        {...(rest as Record<string, unknown>)}
      >
        {children as never}
      </Slot>
    );
  }

  if (href) {
    return (
      <a
        ref={ref as never}
        className={baseClassName}
        href={disabled ? undefined : href}
        target={target}
        rel={rel}
        style={style}
        onClick={disabled ? undefined : (onClick as never)}
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref as never}
      type={htmlType}
      className={baseClassName}
      disabled={disabled || loading}
      style={style as CSSProperties}
      onClick={disabled ? undefined : (onClick as never)}
      {...rest}
    >
      {content}
    </button>
  );
});
