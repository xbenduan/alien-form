import type { CompiledExpression, IFieldSchema, IFormSchema } from "@alien-form/core";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ModelMeta {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: string;
  openMode?: string;
  defaultPageSize?: number;
}

export interface FieldSchema extends Omit<IFieldSchema, "properties" | "items" | "props"> {
  properties?: Record<string, FieldSchema>;
  items?: FieldSchema | FieldSchema[];
  props?: Record<string, unknown>;
  "x-database"?: Record<string, JsonValue>;
  "x-table"?: {
    visible?: boolean;
    width?: number;
    fixed?: "left" | "right";
    filterable?: boolean;
  };
}

export interface PageSchema {
  type?: "object";
  properties: Record<string, FieldSchema>;
}

export interface XPage {
  router: string;
  title?: string;
  layout?: {
    component: string;
    props?: Record<string, unknown>;
  };
  schema: PageSchema;
}

export interface BuilderSchema {
  meta: ModelMeta;
  "x-pages": XPage[];
  definitions: {
    "form-schema": FieldSchema;
    [key: string]: FieldSchema;
  };
}

export interface CompiledValue {
  readonly expression: CompiledExpression;
}

export interface CompiledNode {
  key: string;
  schema: FieldSchema;
  props: Record<string, unknown>;
  slots: Record<string, CompiledNode | CompiledNode[]>;
  children: CompiledNode[];
}

export interface CompiledPage {
  router: string;
  title: string;
  schema: IFormSchema;
  nodes: CompiledNode[];
}
