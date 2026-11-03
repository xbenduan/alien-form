import type { FieldProps } from "formwork";
import type { Component } from "solid-js";
import { Text } from "./primitives";

/** 编辑字符串正文，详情中保留原始换行。 */
export const RichText: Component<FieldProps & { minHeight?: number; maxLines?: number }> = (
  props,
) => <Text {...props} minHeight={props.minHeight ?? 240} />;
