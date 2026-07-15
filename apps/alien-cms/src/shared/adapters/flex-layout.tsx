import type React from "react";
import { Flex } from "../ui";

export function FlexLayout({
  vertical = true,
  gap = 16,
  wrap,
  justify,
  align,
  children,
}: {
  title?: string;
  description?: string;
  vertical?: boolean;
  gap?: number | string;
  wrap?: boolean;
  justify?: string;
  align?: string;
  children?: React.ReactNode;
}) {
  return (
    <Flex
      vertical={vertical}
      gap={gap}
      wrap={wrap}
      justify={justify}
      align={align}
      style={{ marginBottom: 24 }}
    >
      {children}
    </Flex>
  );
}

export default FlexLayout;
