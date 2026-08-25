import { FilterItem, FormItem } from "./decorators";

/** component 名 → React 组件：由组件注册机派生，交给 @alien-form/react 的 FormProvider 消费。 */
export { fieldComponents } from "../register/global/form/registry";

/** 字段装饰器（form / filter 场景的标签与校验外观）。 */
export const fieldDecorators = {
  FormItem,
  FilterItem,
} as const;
