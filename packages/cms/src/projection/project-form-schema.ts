import type { CmsModelSchema } from "../types/schema";
import { canUseInMode, sortSchemaEntries } from "./shared";

export function projectFormSchema(
  schema: CmsModelSchema,
  mode: "add" | "edit",
): CmsModelSchema {
  const properties = Object.fromEntries(
    sortSchemaEntries(schema.properties)
      .filter(([, field]) => canUseInMode(field, mode))
      .map(([key, field]) => [key, field]),
  );

  properties.__form_actions = {
    type: "void",
    component: "FormActions",
    decorator: "FormItem",
    order: 9999,
  };

  return {
    ...schema,
    properties,
  };
}
