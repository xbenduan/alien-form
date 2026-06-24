import {
  Children,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (isValidElement(node)) {
    return extractText((node as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return "";
}

interface TypographyBaseProps {
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
}: TypographyBaseProps) {
  const text = extractText(children);
  const rows = typeof ellipsis === "object" ? ellipsis.rows : undefined;
  const title = ellipsis
    ? typeof ellipsis === "object"
      ? extractText(ellipsis.tooltip ?? children)
      : text
    : undefined;

  const combinedClassName = cn(
    "ant-typography text-[var(--af-text,#2f261f)]",
    type === "secondary" && "text-[rgba(80,63,50,0.68)]",
    strong && "font-semibold",
    italic && "italic",
    ellipsis === true && "block overflow-hidden text-ellipsis whitespace-nowrap",
    className,
  );

  const combinedStyle: CSSProperties | undefined = rows
    ? {
        display: "-webkit-box",
        overflow: "hidden",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: rows,
        ...style,
      }
    : style;

  const inner = code ? (
    <code className="rounded-[6px] bg-[rgba(117,96,77,0.08)] px-1.5 py-0.5 font-mono text-[0.92em]">
      {children}
    </code>
  ) : (
    children
  );

  if (as === "a") {
    return (
      <a
        className={combinedClassName}
        style={combinedStyle}
        title={title}
        href={href}
        target={target}
        rel={rel}
      >
        {inner}
      </a>
    );
  }

  const Tag = as;
  return (
    <Tag className={combinedClassName} style={combinedStyle} title={title}>
      {inner}
    </Tag>
  );
}

export interface TextProps {
  children?: ReactNode;
  type?: "secondary";
  strong?: boolean;
  italic?: boolean;
  code?: boolean;
  ellipsis?: boolean | { rows?: number; tooltip?: ReactNode };
  className?: string;
  style?: CSSProperties;
}

function Text(props: TextProps) {
  return <TypographyBase as="span" {...props} />;
}

function Paragraph(props: TextProps) {
  return <TypographyBase as="p" {...props} className={cn("mb-3 leading-6", props.className)} />;
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
  const tagName = `h${Math.min(level, 5)}` as "h1" | "h2" | "h3" | "h4" | "h5";
  const levelClass: Record<number, string> = {
    1: "text-4xl",
    2: "text-3xl",
    3: "text-2xl",
    4: "text-xl",
    5: "text-lg",
  };
  return (
    <TypographyBase
      as={tagName}
      className={cn(
        "font-serif font-medium tracking-[-0.02em] text-[#2E251E]",
        levelClass[level],
        className,
      )}
      style={{ marginBottom: 10, lineHeight: 1.18, ...style }}
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
      className={cn(
        "text-[var(--af-primary,#C96442)] underline-offset-4 hover:underline",
        props.className,
      )}
      {...props}
    />
  );
}

export const Typography = { Text, Paragraph, Title, Link };
export { extractText };

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
    typeof size === "number"
      ? size
      : size === "small"
        ? 6
        : size === "large"
          ? 12
          : 10;
  return (
    <div
      className={cn(
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
      className={cn("ant-flex flex", vertical && "flex-col", className)}
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

export function Divider({
  children,
  className,
  titlePlacement = "center",
}: {
  children?: ReactNode;
  className?: string;
  titlePlacement?: "left" | "center" | "right" | "start" | "end";
}) {
  const placement =
    titlePlacement === "start" ? "left" : titlePlacement === "end" ? "right" : titlePlacement;
  const lineClass = "h-px bg-[rgba(120,98,79,0.12)]";

  if (!children) {
    return (
      <div className={cn("ant-divider ant-divider-horizontal", className)}>
        <span className={cn(lineClass, "block w-full")} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "ant-divider ant-divider-horizontal ant-divider-with-text flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-[rgba(80,63,50,0.58)]",
        placement === "left" && "ant-divider-with-text-left",
        placement === "center" && "ant-divider-with-text-center",
        placement === "right" && "ant-divider-with-text-right",
        className,
      )}
    >
      <span className={cn(lineClass, placement === "left" ? "w-4 shrink-0" : "flex-1")} />
      <span className="shrink-0">{children}</span>
      <span className={cn(lineClass, placement === "right" ? "w-4 shrink-0" : "flex-1")} />
    </div>
  );
}
