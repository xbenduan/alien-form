import type FieldSchema from "./field-schema.ts";
import {
  COMPONENT_CAPABILITIES,
  ENUM_CAPABILITIES,
  SERVICE_CAPABILITIES,
  UTILITY_CAPABILITIES,
} from "./generated-capabilities.ts";

export type PropertyType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "function"
  | "node";
export type ExpressionScopeName =
  | "mode"
  | "$self"
  | "$form"
  | "$value"
  | "$row"
  | "$path"
  | "$service"
  | "$utils"
  | "$enums"
  | "$query";

export interface PropertyContract {
  type: PropertyType | PropertyType[];
  required?: boolean;
  expression?: boolean;
}

export interface SlotContract {
  multiple?: boolean;
  required?: boolean;
  scope?: ExpressionScopeName[];
}

export interface ComponentCapability {
  code: string;
  meta?: {
    types?: string[];
    kind?: "leaf" | "complex";
    dataSource?: boolean;
    children?: "properties" | "items";
    sample?: Partial<FieldSchema>;
    props?: Record<string, PropertyContract>;
    slots?: Record<string, SlotContract>;
    scope?: ExpressionScopeName[];
  };
}

export interface RuntimeCapability {
  code: string;
  description: string;
}

export interface EnumCapability extends RuntimeCapability {
  value: unknown;
}

export { COMPONENT_CAPABILITIES, SERVICE_CAPABILITIES, UTILITY_CAPABILITIES, ENUM_CAPABILITIES };
