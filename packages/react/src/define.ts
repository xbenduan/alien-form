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
  type?: string;
  [key: string]: any;
}

/** Schema definition object passed to defineComponent (without props — those go to the generic) */
interface SchemaComponentDef {
  type?: SchemaType;
  items?: Record<string, FieldDef> | FieldDef;
  properties?: Record<string, FieldDef>;
  decorator?: string;
}

// ============================================================
// Inferred Props — conditional types based on schema definition
// ============================================================

/** Convert an items/properties record into a typed fields map of ReactNode */
type InferFieldsMap<T> = T extends Record<string, any>
  ? { [K in keyof T]: React.ReactNode }
  : Record<string, React.ReactNode>;

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

/** Final inferred props = base slots + custom props (P) */
type InferComponentProps<S extends SchemaComponentDef, P = {}> = InferBaseSlots<S> & P;

// ============================================================
// defineComponent — the single unified API
// ============================================================

/**
 * Define a custom component with schema-driven type inference.
 *
 * Pass a schema definition object describing the component's structural role,
 * and a generic `P` for your custom props. The returned component's props are
 * fully inferred: base slots come from `type`, custom props come from `P`.
 *
 * @example
 * // --- Normal field component ---
 * interface ImageInputProps {
 *   placeholder?: string;
 *   previewSize?: number;
 * }
 *
 * const ImageInput = defineComponent<typeof schema, ImageInputProps>({
 *   type: "string",
 * })(({ value, onChange, disabled, placeholder, previewSize }) => {
 *   return <div>...</div>;
 * });
 *
 * // Or with inline type parameter:
 * const ImageInput = defineComponent<{ type: "string" }, { placeholder?: string }>({
 *   type: "string",
 * })(({ value, onChange, placeholder }) => <div>...</div>);
 *
 * @example
 * // --- Array component with typed rowFields ---
 * const contactSchema = {
 *   type: "array" as const,
 *   items: {
 *     name: { type: "string" },
 *     phone: { type: "string" },
 *     role: { type: "string" },
 *   },
 * };
 *
 * interface ContactCardsProps {
 *   maxItems?: number;
 *   addText?: string;
 * }
 *
 * const ContactCards = defineComponent<typeof contactSchema, ContactCardsProps>(
 *   contactSchema
 * )(({ rows, rowFields, field, onAdd, onRemove, maxItems, addText }) => {
 *   //    rowFields[0].name  → React.ReactNode ✓
 *   //    rowFields[0].phone → React.ReactNode ✓
 *   //    rowFields[0].xxx   → TS error ✗
 *   return <div>...</div>;
 * });
 *
 * @example
 * // --- Void layout container ---
 * const TwoColumnCard = defineComponent<typeof schema, { gap?: number }>(
 *   { type: "void", properties: { left: { type: "string" }, right: { type: "string" } } }
 * )(({ title, children, fields, gap }) => {
 *   //    fields.left  → React.ReactNode ✓
 *   return <div>...</div>;
 * });
 *
 * @example
 * // --- Decorator ---
 * const InlineFormItem = defineComponent.decorator<{ labelWidth?: number }>()(
 *   ({ label, required, errors, children, labelWidth }) => <div>...</div>
 * );
 */
export function defineComponent<S extends SchemaComponentDef, P = {}>(schema: S) {
  return function <C extends React.FC<InferComponentProps<S, P>>>(component: C): C {
    return component;
  };
}

// --- Decorator variant ---

type InferDecoratorProps<P = {}> = DecoratorBaseSlots & P;

defineComponent.decorator = function <P = {}>() {
  return function <C extends React.FC<InferDecoratorProps<P>>>(component: C): C {
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
  FieldBaseSlots,
  ArrayBaseSlots,
  VoidBaseSlots,
  ObjectBaseSlots,
  DecoratorBaseSlots,
};
