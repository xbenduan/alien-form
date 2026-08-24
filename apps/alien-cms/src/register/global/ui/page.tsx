import { Flex } from "antd";
import { RenderChildren } from "../../../runtime";
import type { UiNodeProps } from "./types";

export function Page({ children, ctx }: UiNodeProps) {
  return (
    <Flex vertical gap={16}>
      <RenderChildren children={children} ctx={ctx} />
    </Flex>
  );
}
