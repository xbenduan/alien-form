/**
 * Type-level test — this file should compile with zero errors when
 * @types/react and @alien-form/core are available.
 *
 * Run: tsc --noEmit --strict
 */

import type React from "react";
import { define, type Resolved } from "../index";

// ============================================================
// 1. Normal field component (type: "string")
// ============================================================

const imageInputSchema = define({
  type: "string",
  props: {
    placeholder: "",
    previewSize: 64,
  },
});

const ImageInput: React.FC<Resolved<typeof imageInputSchema>> = ({
  value,
  onChange,
  disabled,
  loading,
  placeholder,
  previewSize,
}) => {
  // value: any ✓
  // onChange: (value: any) => void ✓
  // disabled?: boolean ✓
  // placeholder?: string ✓
  // previewSize?: number ✓
  return null as any;
};

// ============================================================
// 2. Array component with typed rowFields
// ============================================================

const contactSchema = define({
  type: "array",
  items: {
    name: { type: "string" },
    phone: { type: "string" },
    role: { type: "string" },
  },
  props: {
    maxItems: 0,
    addText: "",
  },
});

const ContactCards: React.FC<Resolved<typeof contactSchema>> = ({
  rows,
  rowFields,
  field,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
  maxItems,
  addText,
}) => {
  // field: IField ✓
  // rows: any[][] ✓
  // rowFields: { name: any; phone: any; role: any }[] ✓
  // maxItems?: number ✓

  const firstRow = rowFields[0];
  const nameSlot = firstRow.name;   // ✓ typed
  const phoneSlot = firstRow.phone; // ✓ typed
  const roleSlot = firstRow.role;   // ✓ typed

  // @ts-expect-error — 'xxx' does not exist on rowFields item
  const bad = firstRow.xxx;

  return null as any;
};

// ============================================================
// 3. Void layout container with typed fields
// ============================================================

const voidSchema = define({
  type: "void",
  properties: {
    left: { type: "string" },
    right: { type: "string" },
  },
  props: {
    gap: 16,
  },
});

const TwoColumnCard: React.FC<Resolved<typeof voidSchema>> = ({
  title,
  description,
  children,
  fields,
  gap,
}) => {
  // fields.left: any ✓
  // fields.right: any ✓
  const leftSlot = fields!.left;
  const rightSlot = fields!.right;

  // @ts-expect-error — 'center' does not exist
  const bad = fields!.center;

  return null as any;
};

// ============================================================
// 4. Object container
// ============================================================

const objectSchema = define({
  type: "object",
  properties: {
    province: { type: "string" },
    city: { type: "string" },
    detail: { type: "string" },
  },
  props: {
    columns: 2,
  },
});

const AddressGroup: React.FC<Resolved<typeof objectSchema>> = ({
  field,
  title,
  description,
  children,
  fields,
  columns,
}) => {
  // field: IField ✓
  // fields.province: any ✓
  const provinceSlot = fields!.province;

  // @ts-expect-error — 'zip' does not exist
  const bad = fields!.zip;

  return null as any;
};

// ============================================================
// 5. Decorator
// ============================================================

const decoratorSchema = define({
  type: "decorator",
  props: {
    labelWidth: 120,
    colon: true,
  },
});

const InlineFormItem: React.FC<Resolved<typeof decoratorSchema>> = ({
  label,
  required,
  errors,
  warnings,
  description,
  validateStatus,
  children,
  labelWidth,
  colon,
}) => {
  // label?: string ✓
  // errors?: FieldError[] ✓
  // labelWidth?: number ✓
  // colon?: boolean ✓
  return null as any;
};

// ============================================================
// 6. No custom props — just omit props in schema
// ============================================================

const simpleSchema = define({ type: "string" });

const SimpleInput: React.FC<Resolved<typeof simpleSchema>> = ({
  value,
  onChange,
  disabled,
}) => {
  return null as any;
};

// ============================================================
// 7. Ensure components are assignable to React.FC<any> (for ComponentMap)
// ============================================================

const _components: Record<string, React.FC<any>> = {
  ImageInput,
  ContactCards,
  TwoColumnCard,
  AddressGroup,
  SimpleInput,
};

const _decorators: Record<string, React.FC<any>> = {
  InlineFormItem,
};
