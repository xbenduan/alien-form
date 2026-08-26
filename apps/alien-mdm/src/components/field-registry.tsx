import { FilterItem, FormItem } from "./decorators";

/** 字段装饰器（form / filter 场景的标签与校验外观）。 */
export const fieldDecorators = {
  FormItem,
  FilterItem,
} as const;
