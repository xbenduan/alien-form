/**
 * @alien-form/react — Component definition helpers
 *
 * Type-safe wrappers for defining custom field components, array components,
 * void/object layout components, and decorators with full IntelliSense.
 *
 * These are zero-runtime identity functions — they exist purely for type inference.
 */

import type React from "react";
import type { IField, FieldError } from "@alien-form/core";

// ============================================================
// Field Component (Normal)
// ============================================================

/**
 * Props automatically injected by the renderer into every normal field component.
 * Custom props from schema `props` are merged on top via the generic `P`.
 */
export interface FieldComponentBaseProps {
  /** Current field value */
  value: any;
  /** Callback to update the field value */
  onChange: (value: any) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is in a loading state */
  loading?: boolean;
  /** Option data source (when field has dataSource) */
  dataSource?: Array<{ label: string; value: any; [key: string]: any }>;
}

/**
 * Full props type for a normal field component.
 * `P` = your custom props from schema `props`.
 */
export type FieldComponentProps<P = {}> = FieldComponentBaseProps & P;

/**
 * Define a normal field component with full type safety.
 *
 * @example
 * const ImageInput = defineFieldComponent<{ placeholder?: string }>(
 *   ({ value, onChange, placeholder, disabled }) => {
 *     return <input value={value ?? ""} onChange={e => onChange(e.target.value)} ... />;
 *   }
 * );
 */
export function defineFieldComponent<P = {}>(
  component: React.FC<FieldComponentProps<P>>,
): React.FC<FieldComponentProps<P>> {
  return component;
}

// ============================================================
// Array Component
// ============================================================

/**
 * Props automatically injected by the renderer into array components.
 */
export interface ArrayComponentBaseProps {
  /** The array field instance */
  field: IField;
  /** Rendered child fields per row: rows[rowIndex][fieldIndex] */
  rows: React.ReactNode[][];
  /** Rendered child fields per row keyed by field name */
  rowFields: Record<string, React.ReactNode>[];
  /** Add a new row (optionally with initial values) */
  onAdd: (initialValues?: Record<string, any>) => void;
  /** Remove row at index */
  onRemove: (index: number) => void;
  /** Move row up */
  onMoveUp: (index: number) => void;
  /** Move row down */
  onMoveDown: (index: number) => void;
  /** Whether the array field is disabled */
  disabled?: boolean;
}

/**
 * Full props type for an array component.
 * `P` = your custom props from schema `props`.
 */
export type ArrayComponentProps<P = {}> = ArrayComponentBaseProps & P;

/**
 * Define an array container component with full type safety.
 *
 * @example
 * const MyArrayCards = defineArrayComponent<{ maxItems?: number; addText?: string }>(
 *   ({ rows, onAdd, onRemove, disabled, maxItems, addText }) => {
 *     return (
 *       <div>
 *         {rows.map((row, i) => <div key={i}>{row}</div>)}
 *         <button onClick={() => onAdd()}>{ addText ?? '+ Add' }</button>
 *       </div>
 *     );
 *   }
 * );
 */
export function defineArrayComponent<P = {}>(
  component: React.FC<ArrayComponentProps<P>>,
): React.FC<ArrayComponentProps<P>> {
  return component;
}

// ============================================================
// Void Component (Layout / Grouping Container)
// ============================================================

/**
 * Props automatically injected by the renderer into void layout components.
 * Void components do NOT receive `field` or `value/onChange`.
 */
export interface VoidComponentBaseProps {
  /** Schema title */
  title?: string;
  /** Schema description */
  description?: string;
  /** Child field nodes (rendered as React children) */
  children?: React.ReactNode;
  /** Child fields keyed by field name */
  fields?: Record<string, React.ReactNode>;
}

/**
 * Full props type for a void/layout component.
 * `P` = your custom props from schema `props`.
 */
export type VoidComponentProps<P = {}> = VoidComponentBaseProps & P;

/**
 * Define a void/layout container component with full type safety.
 *
 * @example
 * const MyCard = defineVoidComponent<{ bordered?: boolean; collapsible?: boolean }>(
 *   ({ title, children, bordered, collapsible }) => {
 *     return (
 *       <div className={bordered ? "border rounded" : ""}>
 *         <h3>{title}</h3>
 *         {children}
 *       </div>
 *     );
 *   }
 * );
 */
export function defineVoidComponent<P = {}>(
  component: React.FC<VoidComponentProps<P>>,
): React.FC<VoidComponentProps<P>> {
  return component;
}

// ============================================================
// Object Component (Object Container)
// ============================================================

/**
 * Props automatically injected by the renderer into object container components.
 */
export interface ObjectComponentBaseProps {
  /** The object field instance */
  field: IField;
  /** Schema title */
  title?: string;
  /** Schema description */
  description?: string;
  /** Child field nodes (rendered as React children) */
  children?: React.ReactNode;
  /** Child fields keyed by field name */
  fields?: Record<string, React.ReactNode>;
}

/**
 * Full props type for an object container component.
 * `P` = your custom props from schema `props`.
 */
export type ObjectComponentProps<P = {}> = ObjectComponentBaseProps & P;

/**
 * Define an object container component with full type safety.
 *
 * @example
 * const AddressGroup = defineObjectComponent<{ columns?: number }>(
 *   ({ title, children, field, columns = 2 }) => {
 *     return (
 *       <div>
 *         <h4>{title}</h4>
 *         <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
 *           {children}
 *         </div>
 *       </div>
 *     );
 *   }
 * );
 */
export function defineObjectComponent<P = {}>(
  component: React.FC<ObjectComponentProps<P>>,
): React.FC<ObjectComponentProps<P>> {
  return component;
}

// ============================================================
// Decorator Component
// ============================================================

/**
 * Props automatically injected by the renderer into decorator components.
 */
export interface DecoratorBaseProps {
  /** Field label (from field.title) */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Validation errors */
  errors?: FieldError[];
  /** Validation warnings */
  warnings?: FieldError[];
  /** Field description */
  description?: string;
  /** Validation status */
  validateStatus?: "success" | "error" | "warning" | "validating" | "";
  /** The rendered field component */
  children?: React.ReactNode;
}

/**
 * Full props type for a decorator component.
 * `P` = your custom props from schema `decoratorProps`.
 */
export type DecoratorProps<P = {}> = DecoratorBaseProps & P;

/**
 * Define a decorator (field wrapper) component with full type safety.
 *
 * @example
 * const InlineFormItem = defineDecorator<{ labelWidth?: number }>(
 *   ({ label, required, errors = [], children, labelWidth = 96 }) => {
 *     return (
 *       <div className="flex items-start gap-3 mb-3">
 *         <label style={{ width: labelWidth }}>
 *           {required && <span className="text-red-500">*</span>}
 *           {label}
 *         </label>
 *         <div className="flex-1">
 *           {children}
 *           {errors.length > 0 && <p className="text-red-500">{errors[0].message}</p>}
 *         </div>
 *       </div>
 *     );
 *   }
 * );
 */
export function defineDecorator<P = {}>(
  component: React.FC<DecoratorProps<P>>,
): React.FC<DecoratorProps<P>> {
  return component;
}
