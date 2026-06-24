import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";

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
      className={cn("ant-row flex flex-wrap", className)}
      style={{
        marginLeft: -horizontal / 2,
        marginRight: -horizontal / 2,
        rowGap: vertical,
        alignItems:
          align === "middle" ? "center" : align === "bottom" ? "flex-end" : "flex-start",
      }}
    >
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<{ style?: CSSProperties }>, {
              style: {
                paddingLeft: horizontal / 2,
                paddingRight: horizontal / 2,
                ...((child as ReactElement<{ style?: CSSProperties }>).props.style ?? {}),
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
      className={cn("ant-col min-w-0", className)}
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
