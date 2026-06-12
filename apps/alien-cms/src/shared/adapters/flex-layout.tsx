import type React from "react";
import { defineAdapter } from "@alien-form/cms";
import { Flex } from "antd";

function FlexLayout({
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

export default defineAdapter(FlexLayout, {
  key: "FlexLayout",
  label: "弹性布局",
  description: "基于 Flex 的容器布局组件。",
  kind: "component",
  scenes: { recordForm: { mode: "edit" }, recordDetail: { mode: "readonly" } },
  meta: { fieldType: "object" },
});
