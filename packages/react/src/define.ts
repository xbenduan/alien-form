/**
 * @alien-form/react — Schema-driven component definition with full type inference
 *
 * A single `defineComponent` function that infers the exact props (slots, actions,
 * custom props) a component will receive based on the schema definition you provide.
 *
 * Zero runtime cost — it's an identity function that only exists for TypeScript inference.
 */

import type React from "react";
import type { IField, FieldError } from "@alien-form/core";

// ============================================================
// Schema Definition Types (used as input to defineComponent)
// ============================================================

type SchemaType = "string" | "number" | "boolean" | "void" | "object" | "array";

interface FieldDef {
  type?: SchemaType;
  [key: string]: any;
}

/** Schema definition object passed to defineComponent */
interface SchemaComponentDef {
  type?: SchemaType;
  items?: Record<string, FieldDef> | FieldDef;
  properties?: Record<string, FieldDef>;
  props?: Record<string, any>;
  decoratorProps?: Record<string, any>;
  decorator?: string;
}

// ============================================================
// Inferred Props — conditional types based on schema definition
// ============================================================

/** Convert an items/properties record into a typed fields map of ReactNode */
type InferFieldsMap<T> = T extends Record<string, any>
  ? { [K in keyof T]: React.ReactNode }
  : Record<string, React.ReactNode>;

/** Infer custom props from schema `props` field */
type InferCustomProps<S extends SchemaComponentDef> =
  S extends { props: infer P } ? { [K in keyof P]: P[K] } : {};

// --- Base props for each category ---

interface FieldBaseSlots {
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  loading?: boolean;
  dataSource?: Array<{ label: string; value: any; [key: string]: any }>;
}

interface VoidBaseSlots<Fields = Record<string, React.ReactNode>> {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  fields?: Fields;
}

interface ObjectBaseSlots<Fields = Record<string, React.ReactNode>> {
  field: IField;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  fields?: Fields;
}

interface ArrayBaseSlots<RowFields = Record<string, React.ReactNode>> {
  field: IField;
  rows: React.ReactNode[][];
  rowFields: RowFields[];
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  disabled?: boolean;
}

/** Decorator base slots */
interface DecoratorBaseSlots {
  label?: string;
  required?: boolean;
  errors?: FieldError[];
  warnings?: FieldError[];
  description?: string;
  validateStatus?: "success" | "error" | "warning" | "validating" | "";
  children?: React.ReactNode;
}

// --- Main conditional inference ---

type InferBaseSlots<S extends SchemaComponentDef> =
  S extends { type: "array" }
    ? S extends { items: infer I }
      ? I extends Record<string, FieldDef>
        ? ArrayBaseSlots<InferFieldsMap<I>>
        : I extends { properties: infer P }
          ? P extends Record<string, any>
            ? ArrayBaseSlots<InferFieldsMap<P>>
            : ArrayBaseSlots
          : ArrayBaseSlots
      : ArrayBaseSlots
    : S extends { type: "void" }
      ? S extends { properties: infer P }
        ? VoidBaseSlots<InferFieldsMap<P>>
        : VoidBaseSlots
      : S extends { type: "object" }
        ? S extends { properties: infer P }
          ? ObjectBaseSlots<InferFieldsMap<P>>
          : ObjectBaseSlots
        : FieldBaseSlots;

/** Final inferred props = base slots + custom props */
type InferComponentProps<S extends SchemaComponentDef> = InferBaseSlots<S> & InferCustomProps<S>;

// ============================================================
// defineComponent — the single unified API
// ============================================================

/**
 * Define a custom component with schema-driven type inference.
 *
 * Pass a schema definition object describing the component's structural role,
 * and get back a typed component factory. The returned component's props are
 * fully inferred: base slots (value/onChange, field, rows, children, etc.)
 * come from `type`, and custom props come from `props`.
 *
 * @example
 * // --- Normal field component ---
 * const ImageInput = defineComponent({
 *   type: "string",
 *   props: { placeholder: "" as string, previewSize: 64 as number },
 * })(({ value, onChange, disabled, placeholder, previewSize }) => {
 *   //    ^-- all inferred: value/onChange from "string", placeholder/previewSize from props
 *   return <div>...</div>;
 * });
 *
 * @example
 * // --- Array component with typed rowFields ---
 * const ContactCards = defineComponent({
 *   type: "array",
 *   items: {
 *     name: { type: "string" },
 *     phone: { type: "string" },
 *     role: { type: "string" },
 *   },
 *   props: { maxItems: 5 as number, addText: "" as string },
 * })(({ rows, rowFields, field, onAdd, onRemove, maxItems, addText }) => {
 *   //    rowFields[0].name  → React.ReactNode ✓
 *   //    rowFields[0].phone → React.ReactNode ✓
 *   //    rowFields[0].xxx   → TS error ✗
 *   return <div>...</div>;
 * });
 *
 * @example
 * // --- Void layout container with typed fields ---
 * const TwoColumnCard = defineComponent({
 *   type: "void",
 *   properties: {
 *     left: { type: "string" },
 *     right: { type: "string" },
 *   },
 *   props: { gap: 16 as number },
 * })(({ title, children, fields, gap }) => {
 *   //    fields.left  → React.ReactNode ✓
 *   //    fields.right → React.ReactNode ✓
 *   return <div style={{ gap }}>...</div>;
 * });
 *
 * @example
 * // --- Object container ---
 * const AddressGroup = defineComponent({
 *   type: "object",
 *   properties: {
 *     province: { type: "string" },
 *     city: { type: "string" },
 *     detail: { type: "string" },
 *   },
 *   props: { columns: 2 as number },
 * })(({ field, title, fields, children, columns }) => {
 *   //    fields.province → React.ReactNode ✓
 *   return <div>...</div>;
 * });
 *
 * @example
 * // --- Decorator ---
 * const InlineFormItem = defineComponent.decorator({
 *   props: { labelWidth: 96 as number },
 * })(({ label, required, errors, children, labelWidth }) => {
 *   return <div>...</div>;
 * });
 */
export function defineComponent<S extends SchemaComponentDef>(schema: S) {
  return function <C extends React.FC<InferComponentProps<S>>>(component: C): C {
    return component;
  };
}

// --- Decorator variant ---

interface DecoratorDef {
  props?: Record<string, any>;
}

type InferDecoratorProps<S extends DecoratorDef> =
  DecoratorBaseSlots & (S extends { props: infer P } ? { [K in keyof P]: P[K] } : {});

defineComponent.decorator = function <S extends DecoratorDef>(schema: S) {
  return function <C extends React.FC<InferDecoratorProps<S>>>(component: C): C {
    return component;
  };
};

// ============================================================
// Exports
// ============================================================

export type {
  SchemaComponentDef,
  InferComponentProps,
  InferDecoratorProps,
  InferFieldsMap,
  InferBaseSlots,
  InferCustomProps,
  FieldBaseSlots,
  ArrayBaseSlots,
  VoidBaseSlots,
  ObjectBaseSlots,
  DecoratorBaseSlots,
};
