import { Flex } from "antd";
import type { ComponentProps } from "@alien-form/engine/react";

export function Page({ children }: ComponentProps) {
  return <Flex vertical gap={16}>{children as React.ReactNode}</Flex>;
}
