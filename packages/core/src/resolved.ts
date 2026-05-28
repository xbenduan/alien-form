/**
 * @alien-form/core — `define` & `Resolved` type utilities
 *
 * A pure type-level tool that infers the complete component props
 * (framework-injected slots + schema-declared custom props) from
 * a single schema definition object.
 *
 * `define` is an identity function that enables TypeScript const narrowing
 * without requiring `as const` on every schema literal.
 *
 * `Resolved<S>` is a conditional type that maps schema → component props.
 *
 * Zero runtime cost. Framework agnostic — React/Vue/Svelte adapters
 * only need to re-export and provide their own ReactNode/VNode type.
 *
 * @example
 * ```ts
 * import { define, type Resolved } from "@alien-form/react";
 *
 * const schema = define({
 *   type: "array",
 *   items: { price: { type: "number" }, stock: { type: "number" } },
 *   props: { emptyText: "", helperText: "" },
 * });
 *
 * const SkuTable: React.FC<Resolved<typeof schema>> = ({
 *   field, rows, rowFields, onAdd, onRemove, emptyText, helperText
 * }) => { ... };
 * ```
 */

import type { IField, FieldError } from "./schema/types";

// ============================================================
// 1. define — identity function with const narrowing
// ============================================================

/**
 * Identity function that triggers TypeScript's `const` type parameter
 * inference (TS 5.0+). Wrapping your schema literal in `define(...)`
 * preserves the exact literal type without needing `as const`.
 *
 * Zero runtime cost — returns the input unchanged.
 */
export function define<const S>(schema: S): S {
  return schema;
}

// ============================================================
// 2. Schema shape types (input to Resolved)
// ============================================================

interface FieldDef {
  type?: string;
  [key: string]: any;
}

// ============================================================
// 3. Slot interfaces — what the framework injects per type
// ============================================================

/**
 * Slots injected for `type: "string" | "number" | "boolean"` fields.
 * A field component edits a single value.
 */
export interface FieldSlots {
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  loading?: boolean;
  dataSource?: Array<{ label: string; value: any; [key: string]: any }>;
}

/**
 * Slots injected for `type: "void"` containers.
 * Void nodes produce no value; child paths are transparent.
 */
export interface VoidSlots<Fields = Record<string, any>> {
  title?: string;
  description?: string;
  children?: any;
  fields?: Fields;
}

/**
 * Slots injected for `type: "object"` containers.
 * Object nodes aggregate child field values into a sub-object.
 */
export interface ObjectSlots<Fields = Record<string, any>> {
  field: IField;
  title?: string;
  description?: string;
  children?: any;
  fields?: Fields;
}

/**
 * Slots injected for `type: "array"` containers.
 * Array nodes manage a dynamic list of row items.
 *
 * @typeParam RowFields - a map of field name → rendered slot (ReactNode in React)
 */
export interface ArraySlots<RowFields = Record<string, any>> {
  field: IField;
  rows: any[][];
  rowFields: RowFields[];
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  disabled?: boolean;
}

/**
 * Slots injected for decorator components.
 * Decorators wrap field chrome: label, errors, required mark.
 */
export interface DecoratorSlots {
  label?: string;
  required?: boolean;
  errors?: FieldError[];
  warnings?: FieldError[];
  description?: string;
  validateStatus?: "success" | "error" | "warning" | "validating" | "";
  children?: any;
}

// ============================================================
// 4. Type inference utilities
// ============================================================

/** Map an items/properties record to a slot map (each key → any, React adapters narrow to ReactNode) */
type InferFieldsMap<T> = T extends Record<string, any>
  ? { [K in keyof T]: any }
  : Record<string, any>;

/** Infer custom props from schema.props — each key becomes optional with its value's base type */
type InferCustomProps<T> = T extends Record<string, any>
  ? { [K in keyof T]?:
      T[K] extends boolean ? boolean
      : T[K] extends number ? number
      : T[K] extends string ? string
      : T[K] extends any[] ? T[K]
      : T[K]
    }
  : {};

/** Infer the framework slots from schema type + items/properties */
type InferSlots<S> =
  S extends { type: "array"; items: infer I }
    ? I extends { properties: infer P }
      ? ArraySlots<InferFieldsMap<P>>
      : ArraySlots<InferFieldsMap<I>>
    : S extends { type: "array" }
      ? ArraySlots
      : S extends { type: "void"; properties: infer P }
        ? VoidSlots<InferFieldsMap<P>>
        : S extends { type: "void" }
          ? VoidSlots
          : S extends { type: "object"; properties: infer P }
            ? ObjectSlots<InferFieldsMap<P>>
            : S extends { type: "object" }
              ? ObjectSlots
              : S extends { type: "decorator" }
                ? DecoratorSlots
                : FieldSlots;

// ============================================================
// 5. Resolved — the single public type
// ============================================================

/**
 * `Resolved<S>` — Derive the full component props type from a schema definition.
 *
 * It combines:
 * - **Slots**: Framework-injected props based on `schema.type` + structure
 * - **Custom Props**: User-declared props from `schema.props`
 *
 * @example
 * ```ts
 * const schema = define({ type: "string", props: { placeholder: "" } });
 * type Props = Resolved<typeof schema>;
 * // Props = { value: any; onChange: (v: any) => void; disabled?: boolean; ... } & { placeholder?: string }
 * ```
 *
 * @example
 * ```ts
 * const schema = define({
 *   type: "array",
 *   items: { name: { type: "string" }, age: { type: "number" } },
 *   props: { addText: "", maxItems: 0 },
 * });
 * type Props = Resolved<typeof schema>;
 * // Props = ArraySlots<{ name: any; age: any }> & { addText?: string; maxItems?: number }
 * ```
 */
export type Resolved<S> =
  InferSlots<S> & InferCustomProps<S extends { props: infer P } ? P : {}>;

// ============================================================
// 6. Role inference (for branded registries)
// ============================================================

/** Infer the component role from schema type — useful for typed registries */
export type InferRole<S> =
  S extends { type: "array" } ? "array"
  : S extends { type: "void" } ? "void"
  : S extends { type: "object" } ? "object"
  : S extends { type: "decorator" } ? "decorator"
  : "field";

// ============================================================
// Exports
// ============================================================

export type {
  FieldDef,
  InferFieldsMap,
  InferCustomProps,
  InferSlots,
};
