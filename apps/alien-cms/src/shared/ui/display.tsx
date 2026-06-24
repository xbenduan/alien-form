import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn";

export function Card({
  children,
  className,
  title,
  extra,
  style,
  styles,
  size = "default",
  tabList,
  activeTabKey,
  onTabChange,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  extra?: ReactNode;
  style?: CSSProperties;
  styles?: { body?: CSSProperties };
  size?: "default" | "small";
  tabList?: Array<{ key: string; tab: ReactNode }>;
  activeTabKey?: string;
  onTabChange?: (key: string) => void;
}) {
  return (
    <div
      className={cn(
        "ant-card overflow-hidden rounded-[14px] border border-[rgba(120,98,79,0.14)] bg-[rgba(255,251,246,0.88)] shadow-[0_10px_26px_rgba(91,68,47,0.07)] backdrop-blur",
        className,
      )}
      style={style}
    >
      {title || extra || tabList?.length ? (
        <div className="ant-card-head border-b border-[rgba(120,98,79,0.12)] px-4 py-3">
          <div className="ant-card-head-wrapper flex items-center justify-between gap-3">
            <div className="ant-card-head-title min-w-0 font-serif text-base text-[#2E251E]">
              {title}
            </div>
            {extra ? <div className="ant-card-extra">{extra}</div> : null}
          </div>
          {tabList?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
              {tabList.map((item) => {
                const active = item.key === activeTabKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={cn(
                      "rounded-[9px] px-2.5 py-1 text-sm transition",
                      active
                        ? "bg-[rgba(201,100,66,0.14)] text-[#A24E31]"
                        : "bg-transparent text-[rgba(80,63,50,0.68)] hover:bg-[rgba(201,100,66,0.08)]",
                    )}
                    onClick={() => onTabChange?.(item.key)}
                  >
                    {item.tab}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("ant-card-body", size === "small" ? "p-3" : "p-4")} style={styles?.body}>
        {children}
      </div>
    </div>
  );
}

export function Tag({
  children,
  className,
  color,
  icon,
  style,
}: {
  children?: ReactNode;
  className?: string;
  color?: string;
  icon?: ReactNode;
  variant?: string;
  style?: CSSProperties;
}) {
  const palette: Record<string, { bg: string; text: string; border: string }> = {
    default: { bg: "rgba(117, 96, 77, 0.08)", text: "#6B5B4D", border: "rgba(117, 96, 77, 0.18)" },
    green: { bg: "rgba(103, 133, 103, 0.12)", text: "#56704A", border: "rgba(103, 133, 103, 0.24)" },
    gold: { bg: "rgba(185, 135, 64, 0.12)", text: "#8C642B", border: "rgba(185, 135, 64, 0.24)" },
    blue: { bg: "rgba(140, 118, 92, 0.12)", text: "#7A5E43", border: "rgba(140, 118, 92, 0.22)" },
    cyan: { bg: "rgba(115, 136, 128, 0.12)", text: "#596E68", border: "rgba(115, 136, 128, 0.22)" },
    geekblue: {
      bg: "rgba(128, 112, 139, 0.12)",
      text: "#6A5D79",
      border: "rgba(128, 112, 139, 0.22)",
    },
    purple: { bg: "rgba(145, 108, 132, 0.12)", text: "#7A5B70", border: "rgba(145, 108, 132, 0.22)" },
    red: { bg: "rgba(201, 100, 66, 0.12)", text: "#A64B2C", border: "rgba(201, 100, 66, 0.24)" },
  };
  const tone = !color
    ? palette.default
    : palette[color]
      ? palette[color]
      : color.startsWith("#")
        ? { bg: `${color}18`, text: color, border: `${color}33` }
        : palette.default;

  return (
    <span
      className={cn(
        "ant-tag inline-flex items-center gap-1 rounded-[8px] border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ background: tone.bg, color: tone.text, borderColor: tone.border, ...style }}
    >
      {icon ? <span className="inline-flex items-center">{icon}</span> : null}
      {children}
    </span>
  );
}

export function Alert({
  type = "info",
  showIcon,
  message: messageNode,
  title,
  description,
  className,
  style,
}: {
  type?: "success" | "info" | "warning" | "error";
  showIcon?: boolean;
  message?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const toneMap = {
    success: "border-[rgba(103,133,103,0.22)] bg-[rgba(246,250,245,0.9)] text-[#4a6040]",
    info: "border-[rgba(117,96,77,0.18)] bg-[rgba(250,247,242,0.9)] text-[#6B5B4D]",
    warning: "border-[rgba(185,135,64,0.24)] bg-[rgba(255,249,241,0.95)] text-[#8C642B]",
    error: "border-[rgba(201,100,66,0.24)] bg-[rgba(255,246,243,0.95)] text-[#9e4f33]",
  } as const;

  return (
    <div
      className={cn("ant-alert rounded-[12px] border px-3.5 py-2.5", toneMap[type], className)}
      style={style}
    >
      <div className="flex items-start gap-2.5">
        {showIcon ? <span className="mt-0.5 text-sm">•</span> : null}
        <div className="min-w-0">
          <div className="font-medium">{messageNode ?? title}</div>
          {description ? <div className="mt-1 text-sm opacity-85">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Spin({
  size = "default",
  className,
}: {
  size?: "small" | "default" | "large";
  className?: string;
}) {
  const sizes = {
    small: "h-4 w-4 border-2",
    default: "h-6 w-6 border-[2.5px]",
    large: "h-9 w-9 border-[3px]",
  } as const;
  return (
    <span className={cn("ant-spin inline-flex items-center justify-center", className)}>
      <span
        className={cn(
          "inline-block animate-spin rounded-full border-[rgba(201,100,66,0.2)] border-t-[var(--af-primary,#C96442)]",
          sizes[size],
        )}
      />
    </span>
  );
}

function EmptyComponent({
  description = "暂无数据",
  className,
  style,
}: {
  description?: ReactNode;
  image?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "ant-empty grid justify-items-center gap-2 py-6 text-center text-[rgba(80,63,50,0.62)]",
        className,
      )}
      style={style}
    >
      <div className="h-10 w-10 rounded-[12px] border border-dashed border-[rgba(120,98,79,0.22)] bg-[rgba(248,243,236,0.75)]" />
      <div className="text-sm">{description}</div>
    </div>
  );
}

export const Empty = Object.assign(EmptyComponent, {
  PRESENTED_IMAGE_SIMPLE: null as ReactNode,
});

export function Image({
  src,
  alt,
  className,
  style,
}: {
  src?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      className={cn(
        "ant-image-img max-w-full rounded-[12px] border border-[rgba(120,98,79,0.12)]",
        className,
      )}
      src={src}
      alt={alt}
      style={style}
    />
  );
}
