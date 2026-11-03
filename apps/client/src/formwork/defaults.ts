import type { Domains } from "formwork";
import { components } from "./components";
import * as recordFns from "./fn/records";
import { FormItem } from "../components/fields/field-container";
import { loadPublishedSchema } from "./api";

/** 显式注册可被多个模型共享的领域覆盖。 */
export const domains: Domains = { cms: () => import("../domains/cms") };
/** 让正式应用与预览共享模型能力，API 和导航由各自 Adapter 注入。 */
export const modelDefaults = {
  getSchema: loadPublishedSchema,
  domains,
  components,
  fn: recordFns,
  fieldContainer: FormItem,
};
