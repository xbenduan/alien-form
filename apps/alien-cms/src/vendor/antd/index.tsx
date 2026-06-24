import React, {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type {
  ColumnType,
  ColumnsType,
  FilterValue,
  SortOrder,
  SorterResult,
  TableColumnsType,
  TablePaginationConfig,
  TableProps,
  TableRowSelection,
} from "./table-types";

export type {
  ColumnType,
  ColumnsType,
  FilterValue,
  SortOrder,
  SorterResult,
  TableColumnsType,
  TablePaginationConfig,
  TableProps,
  TableRowSelection,
} from "./table-types";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function toPixel(value?: number | string) {
  if (typeof value === "number") {
    return `${value}px`;
  }
  return value;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (isValidElement(node)) {
    return extractText((node as ReactElement<any>).props.children);
  }
  return "";
}

function colorTone(color?: string) {
  const palette: Record<string, { bg: string; text: string; border: string }> = {
    default: { bg: "rgba(117, 96, 77, 0.08)", text: "#6B5B4D", border: "rgba(117, 96, 77, 0.18)" },
    green: { bg: "rgba(103, 133, 103, 0.12)", text: "#56704A", border: "rgba(103, 133, 103, 0.24)" },
    gold: { bg: "rgba(185, 135, 64, 0.12)", text: "#8C642B", border: "rgba(185, 135, 64, 0.24)" },
    blue: { bg: "rgba(140, 118, 92, 0.12)", text: "#7A5E43", border: "rgba(140, 118, 92, 0.22)" },
    cyan: { bg: "rgba(115, 136, 128, 0.12)", text: "#596E68", border: "rgba(115, 136, 128, 0.22)" },
    geekblue: { bg: "rgba(128, 112, 139, 0.12)", text: "#6A5D79", border: "rgba(128, 112, 139, 0.22)" },
    purple: { bg: "rgba(145, 108, 132, 0.12)", text: "#7A5B70", border: "rgba(145, 108, 132, 0.22)" },
    red: { bg: "rgba(201, 100, 66, 0.12)", text: "#A64B2C", border: "rgba(201, 100, 66, 0.24)" },
  };
  if (!color) {
    return palette.default;
  }
  if (palette[color]) {
    return palette[color];
  }
  if (color.startsWith("#")) {
    return { bg: `${color}18`, text: color, border: `${color}33` };
  }
  return palette.default;
}

interface ThemeToken {
  colorPrimary?: string;
  borderRadius?: number;
  colorBgLayout?: string;
  colorText?: string;
  fontFamily?: string;
}

const ThemeContext = createContext<ThemeToken>({
  colorPrimary: "#C96442",
  borderRadius: 16,
  colorBgLayout: "#f4ede3",
  colorText: "#2f261f",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
});

export const theme = {
  defaultAlgorithm: Symbol("defaultAlgorithm"),
};

export function ConfigProvider({
  children,
  theme: configTheme,
}: {
  children?: ReactNode;
  theme?: {
    token?: ThemeToken;
    algorithm?: unknown;
    components?: Record<string, unknown>;
  };
}) {
  const value = useMemo<ThemeToken>(
    () => ({
      colorPrimary: configTheme?.token?.colorPrimary ?? "#C96442",
      borderRadius: configTheme?.token?.borderRadius ?? 16,
      colorBgLayout: configTheme?.token?.colorBgLayout ?? "#f4ede3",
      colorText: configTheme?.token?.colorText ?? "#2f261f",
      fontFamily: configTheme?.token?.fontFamily ?? "Inter, ui-sans-serif, system-ui, sans-serif",
    }),
    [configTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        className="ant-config-provider"
        style={
          {
            "--af-primary": value.colorPrimary,
            "--af-radius": `${value.borderRadius ?? 16}px`,
            "--af-bg-layout": value.colorBgLayout,
            "--af-text": value.colorText,
            "--af-font-ui": value.fontFamily,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

type MessageType = "success" | "error" | "info" | "warning";
interface MessageNotice {
  id: number;
  type: MessageType;
  content: ReactNode;
}

let messageId = 0;
const messageListeners = new Set<(notice: MessageNotice) => void>();

function emitMessage(type: MessageType, content: ReactNode) {
  const notice = { id: ++messageId, type, content };
  messageListeners.forEach((listener) => listener(notice));
  return notice.id;
}

type MessageInstance = {
  success: (content: ReactNode) => number;
  error: (content: ReactNode) => number;
  info: (content: ReactNode) => number;
  warning: (content: ReactNode) => number;
  useMessage: () => [MessageInstance, ReactNode];
};

export const message: MessageInstance = {
  success: (content) => emitMessage("success", content),
  error: (content) => emitMessage("error", content),
  info: (content) => emitMessage("info", content),
  warning: (content) => emitMessage("warning", content),
  useMessage: () => [message, null],
};

function MessageViewport() {
  const [notices, setNotices] = useState<MessageNotice[]>([]);

  useEffect(() => {
    const listener = (notice: MessageNotice) => {
      setNotices((current) => [...current, notice]);
      window.setTimeout(() => {
        setNotices((current) => current.filter((item) => item.id !== notice.id));
      }, 2800);
    };
    messageListeners.add(listener);
    return () => {
      messageListeners.delete(listener);
    };
  }, []);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed right-5 top-5 z-[1200] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={cx(
            "pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(91,68,47,0.12)] backdrop-blur",
            notice.type === "success" && "border-[rgba(103,133,103,0.22)] bg-[rgba(246,250,245,0.96)] text-[#4a6040]",
            notice.type === "error" && "border-[rgba(201,100,66,0.24)] bg-[rgba(255,246,243,0.96)] text-[#9e4f33]",
            notice.type === "info" && "border-[rgba(117,96,77,0.18)] bg-[rgba(250,247,242,0.96)] text-[#6B5B4D]",
            notice.type === "warning" && "border-[rgba(185,135,64,0.24)] bg-[rgba(255,249,241,0.96)] text-[#8C642B]",
          )}
        >
          {notice.content}
        </div>
      ))}
    </div>,
    document.body,
  );
}

const AppContext = createContext<{ message: MessageInstance }>({ message });

function AppRoot({ children }: { children?: ReactNode }) {
  return (
    <AppContext.Provider value={{ message }}>
      {children}
      <MessageViewport />
    </AppContext.Provider>
  );
}

export const App = Object.assign(AppRoot, {
  useApp() {
    return useContext(AppContext);
  },
});

export interface ButtonProps extends HTMLAttributes<HTMLElement> {
  type?: "default" | "primary" | "dashed" | "link" | "text";
  size?: "small" | "middle" | "large";
  danger?: boolean;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  htmlType?: "button" | "submit" | "reset";
}

export function Button({
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
  ...rest
}: ButtonProps) {
  const baseClassName = cx(
    "ant-btn inline-flex items-center justify-center gap-2 rounded-[var(--af-radius,16px)] border font-medium transition duration-200",
    block && "flex w-full",
    size === "small" && "min-h-8 px-3 text-xs",
    size === "middle" && "min-h-10 px-4 text-sm",
    size === "large" && "min-h-11 px-5 text-base",
    type === "primary" &&
      "ant-btn-primary border-transparent bg-[var(--af-primary,#C96442)] text-white shadow-[0_12px_24px_rgba(201,100,66,0.18)] hover:brightness-95",
    type === "default" &&
      "border-[rgba(120,98,79,0.18)] bg-white/85 text-[var(--af-text,#2f261f)] hover:border-[rgba(201,100,66,0.35)] hover:text-[#A24E31]",
    type === "dashed" &&
      "border-dashed border-[rgba(120,98,79,0.22)] bg-[rgba(248,243,236,0.78)] text-[var(--af-text,#2f261f)] hover:border-[rgba(201,100,66,0.38)]",
    type === "link" && "ant-btn-link border-transparent bg-transparent px-0 text-[var(--af-primary,#C96442)] shadow-none hover:text-[#a24e31]",
    type === "text" &&
      "ant-btn-text border-transparent bg-transparent text-[var(--af-text,#2f261f)] shadow-none hover:bg-[rgba(201,100,66,0.08)]",
    danger && type !== "primary" && "text-[#A24E31] hover:border-[rgba(201,100,66,0.35)]",
    danger && type === "primary" && "bg-[#A24E31]",
    (disabled || loading) && "cursor-not-allowed opacity-55",
    className,
  );

  const content = (
    <>
      {icon ? <span className="ant-btn-icon inline-flex items-center text-[1.05em]">{icon}</span> : null}
      {loading ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}
      {children ? <span>{children}</span> : null}
    </>
  );

  if (href) {
    return (
      <a
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
}

export function Space({
  children,
  size = 8,
  direction,
  orientation,
  align,
  wrap,
  className,
  style,
}: {
  children?: ReactNode;
  size?: number | "small" | "middle" | "large";
  direction?: "horizontal" | "vertical";
  orientation?: "horizontal" | "vertical";
  align?: string;
  wrap?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const resolvedDirection = orientation ?? direction ?? "horizontal";
  const gap =
    typeof size === "number" ? size : size === "small" ? 8 : size === "large" ? 16 : 12;
  return (
    <div
      className={cx(
        "ant-space flex",
        resolvedDirection === "vertical" ? "flex-col" : "flex-row",
        wrap && resolvedDirection !== "vertical" && "flex-wrap",
        className,
      )}
      style={{ gap, alignItems: align as CSSProperties["alignItems"], ...style }}
    >
      {Children.toArray(children)}
    </div>
  );
}

export function Flex({
  children,
  vertical,
  gap = 0,
  justify,
  align,
  wrap,
  className,
  style,
}: {
  children?: ReactNode;
  vertical?: boolean;
  gap?: number | string;
  justify?: CSSProperties["justifyContent"];
  align?: CSSProperties["alignItems"];
  wrap?: CSSProperties["flexWrap"] | boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("ant-flex flex", vertical && "flex-col", className)}
      style={{
        gap,
        justifyContent: justify,
        alignItems: align,
        flexWrap: typeof wrap === "boolean" ? (wrap ? "wrap" : "nowrap") : wrap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function TypographyBase({
  as,
  children,
  className,
  style,
  strong,
  italic,
  code,
  type,
  ellipsis,
  href,
  target,
  rel,
}: {
  as: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "a";
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  strong?: boolean;
  italic?: boolean;
  code?: boolean;
  type?: "secondary";
  ellipsis?: boolean | { rows?: number; tooltip?: ReactNode };
  href?: string;
  target?: string;
  rel?: string;
}) {
  const text = extractText(children);
  const rows = typeof ellipsis === "object" ? ellipsis.rows : undefined;
  const title =
    ellipsis && (typeof ellipsis === "object" ? extractText(ellipsis.tooltip ?? children) : text)
      ? typeof ellipsis === "object"
        ? extractText(ellipsis.tooltip ?? children)
        : text
      : undefined;
  const componentProps = {
    className: cx(
      "ant-typography text-[var(--af-text,#2f261f)]",
      type === "secondary" && "text-[rgba(80,63,50,0.68)]",
      strong && "font-semibold",
      italic && "italic",
      ellipsis === true && "block overflow-hidden text-ellipsis whitespace-nowrap",
      className,
    ),
    style: rows
      ? {
          display: "-webkit-box",
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: rows,
          ...style,
        }
      : style,
    title,
    href,
    target,
    rel,
  } as Record<string, unknown>;
  const inner =
    code ? (
      <code className="rounded-lg bg-[rgba(117,96,77,0.08)] px-1.5 py-0.5 font-mono text-[0.92em]">
        {children}
      </code>
    ) : (
      children
    );

  return React.createElement(as, componentProps, inner);
}

function Text(props: {
  children?: ReactNode;
  type?: "secondary";
  strong?: boolean;
  italic?: boolean;
  code?: boolean;
  ellipsis?: boolean | { rows?: number; tooltip?: ReactNode };
  className?: string;
  style?: CSSProperties;
}) {
  return <TypographyBase as="span" {...props} />;
}

function Paragraph(props: {
  children?: ReactNode;
  type?: "secondary";
  strong?: boolean;
  italic?: boolean;
  code?: boolean;
  ellipsis?: boolean | { rows?: number; tooltip?: ReactNode };
  className?: string;
  style?: CSSProperties;
}) {
  return <TypographyBase as="p" className={cx("mb-4 leading-7", props.className)} {...props} />;
}

function Title({
  level = 4,
  className,
  style,
  children,
}: {
  level?: 1 | 2 | 3 | 4 | 5;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const tagName = (`h${Math.min(level, 5)}` as "h1" | "h2" | "h3" | "h4" | "h5");
  const levelClass: Record<number, string> = {
    1: "text-5xl",
    2: "text-4xl",
    3: "text-3xl",
    4: "text-2xl",
    5: "text-xl",
  };
  return (
    <TypographyBase
      as={tagName}
      className={cx(
        "font-serif font-medium tracking-[-0.02em] text-[#2E251E]",
        levelClass[level],
        className,
      )}
      style={{ marginBottom: 12, lineHeight: 1.2, ...style }}
    >
      {children}
    </TypographyBase>
  );
}

function Link(props: {
  children?: ReactNode;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <TypographyBase
      as="a"
      className={cx("text-[var(--af-primary,#C96442)] underline-offset-4 hover:underline", props.className)}
      {...props}
    />
  );
}

export const Typography = { Text, Paragraph, Title, Link };

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
  const tone = colorTone(color);
  return (
    <span
      className={cx(
        "ant-tag inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
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
    <div className={cx("ant-alert rounded-2xl border px-4 py-3", toneMap[type], className)} style={style}>
      <div className="flex items-start gap-3">
        {showIcon ? <span className="mt-0.5 text-sm">•</span> : null}
        <div className="min-w-0">
          <div className="font-medium">{messageNode ?? title}</div>
          {description ? <div className="mt-1 text-sm opacity-85">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Spin({ size = "default", className }: { size?: "small" | "default" | "large"; className?: string }) {
  const sizes = {
    small: "h-4 w-4 border-2",
    default: "h-6 w-6 border-[2.5px]",
    large: "h-9 w-9 border-[3px]",
  } as const;
  return (
    <span className={cx("ant-spin inline-flex items-center justify-center", className)}>
      <span
        className={cx(
          "inline-block animate-spin rounded-full border-[rgba(201,100,66,0.2)] border-t-[var(--af-primary,#C96442)]",
          sizes[size],
        )}
      />
    </span>
  );
}

interface OverlayShellProps {
  open?: boolean;
  onClose?: () => void;
  maskClosable?: boolean;
  children?: ReactNode;
}

function OverlayShell({ open, onClose, maskClosable = true, children }: OverlayShellProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }
  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <div
        className="absolute inset-0 bg-[rgba(46,37,30,0.24)] backdrop-blur-[2px]"
        onClick={maskClosable ? onClose : undefined}
      />
      {children}
    </div>,
    document.body,
  );
}

function CloseButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[rgba(80,63,50,0.65)] transition hover:bg-[rgba(201,100,66,0.08)] hover:text-[#A24E31]"
      onClick={onClick}
    >
      ×
    </button>
  );
}

export function Modal({
  open,
  title,
  children,
  footer,
  width = 640,
  centered,
  onCancel,
  onOk,
  okText = "确定",
  cancelText = "取消",
  okButtonProps,
  cancelButtonProps,
  confirmLoading,
  maskClosable = true,
}: {
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode | null;
  width?: number | string;
  centered?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  confirmLoading?: boolean;
  destroyOnHidden?: boolean;
  destroyOnClose?: boolean;
  maskClosable?: boolean;
}) {
  const resolvedFooter =
    footer !== undefined
      ? footer
      : (
          <Space size={8}>
            {cancelButtonProps?.style?.display === "none" ? null : (
              <Button onClick={onCancel} {...cancelButtonProps}>
                {cancelText}
              </Button>
            )}
            <Button type="primary" loading={confirmLoading} onClick={onOk} {...okButtonProps}>
              {okText}
            </Button>
          </Space>
        );

  return (
    <OverlayShell open={open} onClose={onCancel} maskClosable={maskClosable}>
      <div
        className={cx(
          "absolute left-1/2 top-12 w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[28px] border border-[rgba(120,98,79,0.16)] bg-[rgba(252,248,242,0.98)] shadow-[0_32px_70px_rgba(68,49,33,0.22)]",
          centered && "top-1/2 -translate-y-1/2",
        )}
        style={{ width: toPixel(width) }}
      >
        <div className="ant-modal">
          <div className="ant-modal-content">
            <div className="ant-modal-header flex items-center justify-between gap-4 border-b border-[rgba(120,98,79,0.12)] px-6 py-5">
              <div className="ant-modal-title font-serif text-xl text-[#2E251E]">{title}</div>
              <CloseButton onClick={onCancel} />
            </div>
            <div className="ant-modal-body max-h-[70vh] overflow-auto px-6 py-5">{children}</div>
            {resolvedFooter !== null ? (
              <div className="ant-modal-footer flex justify-end border-t border-[rgba(120,98,79,0.12)] px-6 py-4">
                {resolvedFooter}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </OverlayShell>
  );
}

export function Drawer({
  open,
  title,
  children,
  footer,
  width = 520,
  onClose,
  maskClosable = true,
}: {
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode | null;
  width?: number | string;
  onClose?: () => void;
  destroyOnHidden?: boolean;
  maskClosable?: boolean;
}) {
  return (
    <OverlayShell open={open} onClose={onClose} maskClosable={maskClosable}>
      <div
        className="ant-drawer absolute right-0 top-0 h-full border-l border-[rgba(120,98,79,0.12)] bg-[rgba(252,248,242,0.98)] shadow-[-24px_0_60px_rgba(68,49,33,0.18)]"
        style={{ width: toPixel(width), maxWidth: "calc(100vw - 24px)" }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-[rgba(120,98,79,0.12)] px-6 py-5">
            <div className="font-serif text-xl text-[#2E251E]">{title}</div>
            <CloseButton onClick={onClose} />
          </div>
          <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
          {footer !== null && footer !== undefined ? (
            <div className="border-t border-[rgba(120,98,79,0.12)] px-6 py-4">{footer}</div>
          ) : null}
        </div>
      </div>
    </OverlayShell>
  );
}

export function Tooltip({
  children,
  title,
}: {
  children?: ReactNode;
  title?: ReactNode;
}) {
  const textTitle = typeof title === "string" ? title : extractText(title);
  return (
    <span className="ant-tooltip-open inline-flex" title={textTitle || undefined}>
      {children}
    </span>
  );
}

export function Popconfirm({
  children,
  title,
  description,
  onConfirm,
}: {
  children: ReactElement;
  title?: ReactNode;
  description?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: ButtonProps;
  onConfirm?: () => void | Promise<void>;
}) {
  const promptText = [extractText(title), extractText(description)].filter(Boolean).join("\n");
  return cloneElement(children, {
    onClick: async (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const allowed = typeof window === "undefined" ? true : window.confirm(promptText || "确认继续吗？");
      if (allowed) {
        await onConfirm?.();
      }
    },
  } as never);
}

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
  styles?: {
    body?: CSSProperties;
  };
  size?: "default" | "small";
  tabList?: Array<{ key: string; tab: ReactNode }>;
  activeTabKey?: string;
  onTabChange?: (key: string) => void;
}) {
  return (
    <div
      className={cx(
        "ant-card overflow-hidden rounded-[24px] border border-[rgba(120,98,79,0.14)] bg-[rgba(255,251,246,0.86)] shadow-[0_16px_40px_rgba(91,68,47,0.08)] backdrop-blur",
        className,
      )}
      style={style}
    >
      {(title || extra || tabList?.length) ? (
        <div className="ant-card-head border-b border-[rgba(120,98,79,0.12)] px-5 py-4">
          <div className="ant-card-head-wrapper flex items-center justify-between gap-4">
            <div className="ant-card-head-title min-w-0 font-serif text-lg text-[#2E251E]">{title}</div>
            {extra ? <div className="ant-card-extra">{extra}</div> : null}
          </div>
          {tabList?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {tabList.map((item) => {
                const active = item.key === activeTabKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cx(
                      "rounded-full px-3 py-1.5 text-sm transition",
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
      <div className={cx("ant-card-body", size === "small" ? "p-4" : "p-5")} style={styles?.body}>
        {children}
      </div>
    </div>
  );
}

export function Divider({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
  titlePlacement?: "start" | "center" | "end";
}) {
  return (
    <div className={cx("ant-divider ant-divider-horizontal flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-[rgba(80,63,50,0.58)]", className)}>
      <span className="h-px flex-1 bg-[rgba(120,98,79,0.12)]" />
      {children ? <span>{children}</span> : null}
      <span className="h-px flex-1 bg-[rgba(120,98,79,0.12)]" />
    </div>
  );
}

export function Menu({
  items = [],
  selectedKeys = [],
  onClick,
  className,
}: {
  items?: Array<{ key: React.Key; icon?: ReactNode; label?: ReactNode }>;
  selectedKeys?: React.Key[];
  onClick?: (info: { key: React.Key }) => void;
  mode?: "inline" | "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div className={cx("ant-menu ant-menu-root ant-menu-inline grid gap-1", className)}>
      {items.map((item) => {
        const active = selectedKeys.includes(item.key);
        return (
          <button
            key={String(item.key)}
            type="button"
            className={cx(
              "ant-menu-item flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition",
              active
                ? "ant-menu-item-selected bg-[rgba(201,100,66,0.12)] font-medium text-[#A24E31]"
                : "text-[rgba(80,63,50,0.78)] hover:bg-[rgba(201,100,66,0.07)] hover:text-[#A24E31]",
            )}
            onClick={() => onClick?.({ key: item.key })}
          >
            {item.icon ? <span className="inline-flex items-center text-base">{item.icon}</span> : null}
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Dropdown({
  children,
  menu,
}: {
  children: ReactElement;
  trigger?: Array<"click" | "hover">;
  menu: {
    items?: Array<{ key: React.Key; label?: ReactNode }>;
    onClick?: (info: { key: React.Key }) => void;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ant-dropdown-trigger relative inline-flex">
      {cloneElement(children as ReactElement<any>, {
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          event.preventDefault();
          setOpen((current) => !current);
        },
      } as never)}
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-40 rounded-2xl border border-[rgba(120,98,79,0.14)] bg-[rgba(255,251,246,0.98)] p-2 shadow-[0_20px_48px_rgba(68,49,33,0.18)]">
          {(menu.items ?? []).map((item) => (
            <button
              key={String(item.key)}
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--af-text,#2f261f)] hover:bg-[rgba(201,100,66,0.08)]"
              onClick={() => {
                setOpen(false);
                menu.onClick?.({ key: item.key });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Row({
  children,
  gutter = 0,
  align,
  className,
}: {
  children?: ReactNode;
  gutter?: number | [number, number];
  align?: "top" | "middle" | "bottom";
  className?: string;
}) {
  const [horizontal, vertical] = Array.isArray(gutter) ? gutter : [gutter, gutter];
  return (
    <div
      className={cx("ant-row flex flex-wrap", className)}
      style={{
        marginLeft: -horizontal / 2,
        marginRight: -horizontal / 2,
        rowGap: vertical,
        alignItems: align === "middle" ? "center" : align === "bottom" ? "flex-end" : "flex-start",
      }}
    >
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<any>, {
              style: {
                paddingLeft: horizontal / 2,
                paddingRight: horizontal / 2,
                ...(child.props.style ?? {}),
              },
            })
          : child,
      )}
    </div>
  );
}

export function Col({
  children,
  span,
  flex,
  className,
  style,
}: {
  children?: ReactNode;
  span?: number;
  flex?: string | number;
  className?: string;
  style?: CSSProperties;
}) {
  const width = typeof span === "number" ? `${(span / 24) * 100}%` : undefined;
  return (
    <div
      className={cx("ant-col min-w-0", className)}
      style={{
        width,
        flex: flex ?? (width ? `0 0 ${width}` : "1 1 0%"),
        maxWidth: width,
        ...style,
      }}
    >
      {children}
    </div>
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
    <div className={cx("ant-empty grid justify-items-center gap-2 py-8 text-center text-[rgba(80,63,50,0.62)]", className)} style={style}>
      <div className="h-12 w-12 rounded-full border border-dashed border-[rgba(120,98,79,0.22)] bg-[rgba(248,243,236,0.75)]" />
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
      className={cx("ant-image-img max-w-full rounded-2xl border border-[rgba(120,98,79,0.12)]", className)}
      src={src}
      alt={alt}
      style={style}
    />
  );
}

const FormContext = createContext<{ layout?: "horizontal" | "vertical" }>({ layout: "vertical" });

function FormItem({
  label,
  children,
  required,
  extra,
}: {
  label?: ReactNode;
  children?: ReactNode;
  required?: boolean;
  extra?: ReactNode;
}) {
  const { layout } = useContext(FormContext);
  return (
    <div className="ant-form-item mb-4">
      {label ? (
        <div
          className={cx(
            "ant-form-item-label mb-2 text-sm font-medium text-[rgba(47,38,31,0.88)]",
            layout === "horizontal" && "mb-1",
          )}
        >
          {required ? <span className="mr-1 text-[#C96442]">*</span> : null}
          {label}
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
      <div className={cx("ant-form", className)}>{children}</div>
    </FormContext.Provider>
  );
}

export const Form = Object.assign(FormRoot, { Item: FormItem });

type ChangeEventLike = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

export interface InputProps {
  value?: string | number;
  onChange?: (event: ChangeEventLike) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  className?: string;
  style?: CSSProperties;
  min?: number;
  max?: number;
  rows?: number;
}

function InputComponent({
  className,
  style,
  ...props
}: InputProps) {
  return (
    <input
      className={cx(
        "ant-input min-h-10 w-full rounded-[18px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition placeholder:text-[rgba(80,63,50,0.42)] focus:border-[rgba(201,100,66,0.45)] focus:ring-4 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
        className,
      )}
      style={style}
      {...props}
    />
  );
}

function InputTextArea({
  className,
  style,
  autoSize,
  ...props
}: InputProps & { autoSize?: { minRows?: number; maxRows?: number } | boolean }) {
  const rows = typeof autoSize === "object" ? autoSize.minRows ?? 3 : 3;
  return (
    <textarea
      rows={rows}
      className={cx(
        "ant-input min-h-24 w-full rounded-[18px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3.5 py-2.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition placeholder:text-[rgba(80,63,50,0.42)] focus:border-[rgba(201,100,66,0.45)] focus:ring-4 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
        className,
      )}
      style={style}
      {...props}
    />
  );
}

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
      className={cx(
        "ant-input-number min-h-10 w-full rounded-[18px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition placeholder:text-[rgba(80,63,50,0.42)] focus:border-[rgba(201,100,66,0.45)] focus:ring-4 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
        className,
      )}
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

interface SelectOption {
  label?: ReactNode;
  value: string | number | boolean;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options = [],
  mode,
  allowClear,
  disabled,
  placeholder,
  style,
  className,
}: {
  value?: unknown;
  onChange?: (value: any) => void;
  options?: SelectOption[];
  mode?: "multiple" | "tags";
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const resolveOptionValue = (rawValue: string) => {
    const matched = options.find((option) => String(option.value) === rawValue);
    return matched ? matched.value : rawValue;
  };

  if (mode === "tags") {
    return (
      <input
        className={cx(
          "ant-select ant-select-selector min-h-10 w-full rounded-[18px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition placeholder:text-[rgba(80,63,50,0.42)] focus:border-[rgba(201,100,66,0.45)] focus:ring-4 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
          className,
        )}
        style={style}
        disabled={disabled}
        placeholder={placeholder}
        value={Array.isArray(value) ? value.join(", ") : ""}
        onChange={(event) =>
          onChange?.(
            event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    );
  }

  if (mode === "multiple") {
    const current = Array.isArray(value) ? value.map(String) : [];
    return (
      <select
        multiple
        disabled={disabled}
        className={cx(
          "ant-select min-h-24 w-full rounded-[18px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3.5 py-2.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition focus:border-[rgba(201,100,66,0.45)] focus:ring-4 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
          className,
        )}
        style={style}
        value={current}
        onChange={(event) =>
          onChange?.(
            Array.from(event.target.selectedOptions).map((option) => resolveOptionValue(option.value)),
          )
        }
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
            {extractText(option.label)}
          </option>
        ))}
      </select>
    );
  }

  const currentValue = value === undefined || value === null || value === "" ? "" : String(value);
  return (
    <select
      disabled={disabled}
      className={cx(
        "ant-select ant-select-selector min-h-10 w-full rounded-[18px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition focus:border-[rgba(201,100,66,0.45)] focus:ring-4 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
        className,
      )}
      style={style}
      value={currentValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (allowClear && nextValue === "") {
          onChange?.(undefined);
          return;
        }
        onChange?.(resolveOptionValue(nextValue));
      }}
    >
      <option value="">{placeholder ?? "请选择"}</option>
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
          {extractText(option.label)}
        </option>
      ))}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx(
        "ant-switch relative inline-flex h-7 w-12 items-center rounded-full border transition",
        checked
          ? "border-transparent bg-[var(--af-primary,#C96442)]"
          : "border-[rgba(120,98,79,0.18)] bg-[rgba(120,98,79,0.12)]",
        disabled && "cursor-not-allowed opacity-50",
      )}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function CheckboxBase({
  checked,
  onChange,
  children,
  value,
  disabled,
}: {
  checked?: boolean;
  onChange?: (event: { target: { checked: boolean; value?: unknown } }) => void;
  children?: ReactNode;
  value?: unknown;
  disabled?: boolean;
}) {
  return (
    <label className={cx("ant-checkbox-wrapper inline-flex items-center gap-2 text-sm text-[var(--af-text,#2f261f)]", disabled && "opacity-55")}>
      <input
        type="checkbox"
        className="ant-checkbox accent-[var(--af-primary,#C96442)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.({ target: { checked: event.target.checked, value } })}
      />
      <span>{children}</span>
    </label>
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
      <div className={cx("ant-checkbox-group flex flex-wrap gap-3", className)} style={style}>
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

  return <div className={cx("ant-checkbox-group", className)} style={style}>{children}</div>;
}

function CheckboxComponent(props: {
  checked?: boolean;
  value?: unknown;
  disabled?: boolean;
  onChange?: (event: { target: { checked: boolean; value?: unknown } }) => void;
  children?: ReactNode;
}) {
  return <CheckboxBase {...props} />;
}

export const Checkbox = Object.assign(CheckboxComponent, { Group: CheckboxGroup });

function RadioOption({
  checked,
  disabled,
  onChange,
  children,
  value,
}: {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (event: { target: { value: unknown } }) => void;
  children?: ReactNode;
  value?: unknown;
}) {
  return (
    <label className={cx("ant-radio-wrapper inline-flex items-center gap-2 text-sm text-[var(--af-text,#2f261f)]", disabled && "opacity-55")}>
      <input
        type="radio"
        className="ant-radio accent-[var(--af-primary,#C96442)]"
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.({ target: { value } })}
      />
      <span>{children}</span>
    </label>
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
  const clonedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }
    return cloneElement(child as ReactElement<any>, {
      checked: child.props.value === value,
      disabled: disabled || child.props.disabled,
      onChange,
    });
  });
  return <div className="ant-radio-group flex flex-wrap gap-3">{clonedChildren}</div>;
}

function RadioComponent(props: {
  checked?: boolean;
  disabled?: boolean;
  value?: unknown;
  onChange?: (event: { target: { value: unknown } }) => void;
  children?: ReactNode;
}) {
  return <RadioOption {...props} />;
}

export const Radio = Object.assign(RadioComponent, { Group: RadioGroup });

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value === "object" && value !== null) {
    if ("format" in value && typeof (value as { format?: (mask?: string) => string }).format === "function") {
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
  onChange?: (value: any, dateString: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <input
      type="date"
      className={cx(
        "ant-picker min-h-10 w-full rounded-[18px] border border-[rgba(120,98,79,0.16)] bg-[rgba(255,252,248,0.96)] px-3.5 text-sm text-[var(--af-text,#2f261f)] outline-none transition focus:border-[rgba(201,100,66,0.45)] focus:ring-4 focus:ring-[rgba(201,100,66,0.08)] disabled:cursor-not-allowed disabled:bg-[rgba(241,234,226,0.8)]",
        className,
      )}
      style={style}
      disabled={disabled}
      placeholder={placeholder}
      value={normalizeDateValue(value)}
      onChange={(event) => onChange?.(event.target.value, event.target.value)}
    />
  );
}

export function Rate({
  value = 0,
  onChange,
  disabled,
}: {
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="ant-rate inline-flex gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const active = index < value;
        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            className={cx("text-xl transition", active ? "text-[#C96442]" : "text-[rgba(120,98,79,0.25)]", disabled && "cursor-not-allowed")}
            onClick={() => onChange?.(index + 1)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

interface DescriptionsItemProps {
  label?: ReactNode;
  children?: ReactNode;
}

function DescriptionsItem({ children }: DescriptionsItemProps) {
  return <>{children}</>;
}

function DescriptionsRoot({
  children,
  className,
}: {
  children?: ReactNode;
  column?: number;
  size?: "small" | "middle" | "default";
  bordered?: boolean;
  className?: string;
}) {
  const items = Children.toArray(children) as Array<ReactElement<DescriptionsItemProps>>;
  return (
    <div className={cx("ant-descriptions overflow-hidden rounded-2xl border border-[rgba(120,98,79,0.14)] bg-[rgba(255,252,248,0.85)]", className)}>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[120px_1fr] border-b border-[rgba(120,98,79,0.1)] px-4 py-3 last:border-b-0">
          <div className="text-sm font-medium text-[rgba(80,63,50,0.68)]">{item.props.label}</div>
          <div className="min-w-0 text-sm text-[var(--af-text,#2f261f)]">{item.props.children}</div>
        </div>
      ))}
    </div>
  );
}

export const Descriptions = Object.assign(DescriptionsRoot, { Item: DescriptionsItem });

export function Steps({
  current = 0,
  items = [],
}: {
  current?: number;
  items?: Array<{ title?: ReactNode; description?: ReactNode }>;
}) {
  return (
    <div className="ant-steps grid gap-3 md:grid-cols-3">
      {items.map((item, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div
            key={index}
            className={cx(
              "rounded-2xl border px-4 py-3",
              active && "border-[rgba(201,100,66,0.24)] bg-[rgba(201,100,66,0.08)]",
              done && "border-[rgba(103,133,103,0.22)] bg-[rgba(246,250,245,0.9)]",
              !active && !done && "border-[rgba(120,98,79,0.12)] bg-[rgba(255,252,248,0.7)]",
            )}
          >
            <div className="mb-1 flex items-center gap-3">
              <span
                className={cx(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  active && "bg-[var(--af-primary,#C96442)] text-white",
                  done && "bg-[#678567] text-white",
                  !active && !done && "bg-[rgba(120,98,79,0.12)] text-[rgba(80,63,50,0.72)]",
                )}
              >
                {index + 1}
              </span>
              <span className="font-medium text-[var(--af-text,#2f261f)]">{item.title}</span>
            </div>
            {item.description ? <div className="text-sm text-[rgba(80,63,50,0.62)]">{item.description}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function resolveRowKey<T>(record: T, rowKey: string | ((record: T) => React.Key), index: number) {
  if (typeof rowKey === "function") {
    return rowKey(record);
  }
  if (record && typeof record === "object" && rowKey in (record as Record<string, unknown>)) {
    return (record as Record<string, React.Key>)[rowKey];
  }
  return index;
}

function readCellValue<T>(record: T, dataIndex: ColumnType<T>["dataIndex"]) {
  if (!dataIndex) {
    return undefined;
  }
  const path = Array.isArray(dataIndex) ? dataIndex : String(dataIndex).split(".");
  let current: unknown = record;
  for (const segment of path) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return current;
}

function sortData<T>(data: T[], sorter?: SorterResult<T>) {
  if (!sorter?.order || !sorter.field) {
    return data;
  }
  const direction = sorter.order === "ascend" ? 1 : -1;
  return [...data].sort((left, right) => {
    const leftValue = readCellValue(left, sorter.field as string);
    const rightValue = readCellValue(right, sorter.field as string);
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return -1 * direction;
    if (rightValue == null) return 1 * direction;
    if (leftValue === rightValue) return 0;
    return leftValue > rightValue ? direction : -direction;
  });
}

export const Table = <T extends object>({
  rowKey = "key",
  columns = [],
  dataSource = [],
  loading,
  locale,
  pagination = false,
  rowSelection,
  onChange,
  size = "middle",
}: TableProps<T>) => {
  const [internalPage, setInternalPage] = useState(pagination === false ? 1 : pagination.current ?? 1);
  const [internalPageSize, setInternalPageSize] = useState(
    pagination === false ? dataSource.length || 10 : pagination.pageSize ?? 10,
  );
  const [internalSorter, setInternalSorter] = useState<SorterResult<T>>();

  useEffect(() => {
    if (pagination !== false) {
      setInternalPage(pagination.current ?? 1);
      setInternalPageSize(pagination.pageSize ?? 10);
    }
  }, [pagination]);

  const controlledSorter = columns.find((column) => column.sortOrder)?.sortOrder
    ? {
        field: (columns.find((column) => column.sortOrder)?.dataIndex ??
          columns.find((column) => column.sortOrder)?.key) as string,
        order: columns.find((column) => column.sortOrder)?.sortOrder ?? undefined,
      }
    : undefined;
  const activeSorter = controlledSorter ?? internalSorter;
  const sortedData = sortData(dataSource, activeSorter);
  const page = pagination === false ? 1 : internalPage;
  const pageSize = pagination === false ? sortedData.length || internalPageSize : internalPageSize;
  const total = pagination === false ? sortedData.length : pagination.total ?? sortedData.length;
  const start = pagination === false ? 0 : (page - 1) * pageSize;
  const currentData = pagination === false ? sortedData : sortedData.slice(start, start + pageSize);
  const selectedRowKeys = rowSelection?.selectedRowKeys ?? [];
  const rowMap = new Map(
    dataSource.map((record, index) => [resolveRowKey(record, rowKey, index), record]),
  );

  const toggleSort = (column: ColumnType<T>) => {
    if (!column.sorter) return;
    const key = (column.dataIndex ?? column.key) as string;
    const currentOrder =
      activeSorter?.field === key ? activeSorter.order : column.sortOrder ?? undefined;
    const nextOrder: SortOrder | undefined =
      currentOrder === "ascend" ? "descend" : currentOrder === "descend" ? undefined : "ascend";
    const nextSorter: SorterResult<T> = { field: key, order: nextOrder, column, columnKey: column.key };
    setInternalSorter(nextSorter);
    onChange?.(
      {
        current: 1,
        pageSize,
        total,
        showSizeChanger: pagination !== false ? pagination.showSizeChanger : false,
        showTotal: pagination !== false ? pagination.showTotal : undefined,
      },
      {},
      nextSorter,
    );
    setInternalPage(1);
  };

  const updateSelection = (nextKeys: React.Key[]) => {
    rowSelection?.onChange?.(
      nextKeys,
      nextKeys.map((key) => rowMap.get(key)).filter(Boolean) as T[],
    );
  };

  const allPageRowKeys = currentData.map((record, index) => resolveRowKey(record, rowKey, start + index));
  const allChecked =
    allPageRowKeys.length > 0 && allPageRowKeys.every((key) => selectedRowKeys.includes(key));

  return (
    <div className="ant-table-wrapper">
      <div className="overflow-hidden rounded-[22px] border border-[rgba(120,98,79,0.12)] bg-[rgba(255,252,248,0.82)]">
        <div className="overflow-auto">
          <table className="ant-table w-full border-collapse">
            <thead className="ant-table-thead bg-[rgba(244,236,227,0.78)]">
              <tr>
                {rowSelection ? (
                  <th className="w-12 border-b border-[rgba(120,98,79,0.12)] px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      className="accent-[var(--af-primary,#C96442)]"
                      checked={allChecked}
                      onChange={(event) =>
                        updateSelection(
                          event.target.checked
                            ? Array.from(new Set([...selectedRowKeys, ...allPageRowKeys]))
                            : selectedRowKeys.filter((key) => !allPageRowKeys.includes(key)),
                        )
                      }
                    />
                  </th>
                ) : null}
                {columns.map((column, index) => {
                  const key = String(column.key ?? column.dataIndex ?? index);
                  const columnOrder =
                    activeSorter?.field === (column.dataIndex ?? column.key)
                      ? activeSorter?.order
                      : column.sortOrder ?? undefined;
                  return (
                    <th
                      key={key}
                      className={cx(
                        "border-b border-[rgba(120,98,79,0.12)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[rgba(80,63,50,0.58)]",
                        column.sorter && "cursor-pointer select-none",
                      )}
                      style={{ width: toPixel(column.width) }}
                      onClick={() => toggleSort(column)}
                    >
                      <span className="inline-flex items-center gap-2">
                        {column.title}
                        {column.sorter ? (
                          <span className="text-[10px]">
                            {columnOrder === "ascend" ? "↑" : columnOrder === "descend" ? "↓" : "↕"}
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="ant-table-tbody">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowSelection ? 1 : 0)}
                    className="px-4 py-10 text-center"
                  >
                    <Spin size={size === "small" ? "small" : "large"} />
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowSelection ? 1 : 0)}
                    className="px-4 py-8"
                  >
                    {locale?.emptyText ?? <Empty />}
                  </td>
                </tr>
              ) : (
                currentData.map((record, rowIndex) => {
                  const key = resolveRowKey(record, rowKey, start + rowIndex);
                  return (
                    <tr key={String(key)} className="border-b border-[rgba(120,98,79,0.08)] last:border-b-0">
                      {rowSelection ? (
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            className="accent-[var(--af-primary,#C96442)]"
                            checked={selectedRowKeys.includes(key)}
                            onChange={(event) => {
                              const nextKeys = event.target.checked
                                ? [...selectedRowKeys, key]
                                : selectedRowKeys.filter((item) => item !== key);
                              updateSelection(Array.from(new Set(nextKeys)));
                            }}
                          />
                        </td>
                      ) : null}
                      {columns.map((column, columnIndex) => {
                        const cellValue = readCellValue(record, column.dataIndex);
                        const rendered =
                          (column.render?.(cellValue, record, rowIndex) ?? cellValue ?? "—") as ReactNode;
                        return (
                          <td
                            key={String(column.key ?? column.dataIndex ?? columnIndex)}
                            className="px-4 py-3 align-top text-sm text-[var(--af-text,#2f261f)]"
                            style={{ width: toPixel(column.width) }}
                            title={column.ellipsis && typeof rendered === "string" ? rendered : undefined}
                          >
                            {column.ellipsis ? (
                              <div className="overflow-hidden text-ellipsis whitespace-nowrap">{rendered}</div>
                            ) : (
                              rendered
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {pagination !== false ? (
        <div className="ant-table-pagination mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[rgba(80,63,50,0.68)]">
          <div>
            {pagination.showTotal
              ? pagination.showTotal(total, [Math.min(start + 1, total), Math.min(start + currentData.length, total)])
              : `共 ${total} 条`}
          </div>
          <div className="flex items-center gap-2">
            {pagination.showSizeChanger ? (
              <select
                className="rounded-xl border border-[rgba(120,98,79,0.16)] bg-white/85 px-2 py-1"
                value={pageSize}
                onChange={(event) => {
                  const nextPageSize = Number(event.target.value);
                  setInternalPageSize(nextPageSize);
                  setInternalPage(1);
                  onChange?.(
                    { ...pagination, current: 1, pageSize: nextPageSize, total },
                    {},
                    (activeSorter ?? undefined) as SorterResult<T>,
                  );
                }}
              >
                {[10, 20, 50, 100].map((option) => (
                  <option key={option} value={option}>
                    {option} / 页
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              size="small"
              disabled={page <= 1}
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                setInternalPage(nextPage);
                onChange?.(
                  { ...pagination, current: nextPage, pageSize, total },
                  {},
                  (activeSorter ?? undefined) as SorterResult<T>,
                );
              }}
            >
              上一页
            </Button>
            <span>
              第 {page} / {Math.max(1, Math.ceil(total / Math.max(1, pageSize)))} 页
            </span>
            <Button
              size="small"
              disabled={page >= Math.ceil(total / Math.max(1, pageSize))}
              onClick={() => {
                const nextPage = Math.min(Math.max(1, Math.ceil(total / Math.max(1, pageSize))), page + 1);
                setInternalPage(nextPage);
                onChange?.(
                  { ...pagination, current: nextPage, pageSize, total },
                  {},
                  (activeSorter ?? undefined) as SorterResult<T>,
                );
              }}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
