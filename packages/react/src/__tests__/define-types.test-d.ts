/**
 * Type-level test — this file should compile with zero errors when
 * @types/react and @alien-form/core are available.
 *
 * Run: tsc --noEmit --strict packages/react/src/__tests__/define-types.test-d.ts
 */

import type React from "react";
import { defineComponent } from "../define";

// ============================================================
// 1. Normal field component (type: "string")
// ============================================================

const ImageInput = defineComponent({
  type: "string",
  props: {
    placeholder: "" as string,
    previewSize: 64 as number,
  },
})(({ value, onChange, disabled, loading, placeholder, previewSize }) => {
  // value: any ✓
  // onChange: (value: any) => void ✓
  // disabled?: boolean ✓
  // placeholder: string ✓
  // previewSize: number ✓
  return null as any;
});

// ============================================================
// 2. Array component with typed rowFields
// ============================================================

const ContactCards = defineComponent({
  type: "array",
  items: {
    name: { type: "string" },
    phone: { type: "string" },
    role: { type: "string" },
  },
  props: {
    maxItems: 5 as number,
    addText: "" as string,
  },
})(({ rows, rowFields, field, onAdd, onRemove, onMoveUp, onMoveDown, disabled, maxItems, addText }) => {
  // field: IField ✓
  // rows: ReactNode[][] ✓
  // rowFields: { name: ReactNode; phone: ReactNode; role: ReactNode }[] ✓
  // onAdd: (initialValues?) => void ✓
  // maxItems: number ✓

  const firstRow = rowFields[0];
  const nameSlot: React.ReactNode = firstRow.name;  // ✓ typed
  const phoneSlot: React.ReactNode = firstRow.phone; // ✓ typed
  const roleSlot: React.ReactNode = firstRow.role;   // ✓ typed

  // @ts-expect-error — 'xxx' does not exist
  const bad = firstRow.xxx;

  return null as any;
});

// ============================================================
// 3. Void layout container with typed fields
// ============================================================

const TwoColumnCard = defineComponent({
  type: "void",
  properties: {
    left: { type: "string" },
    right: { type: "string" },
  },
  props: {
    gap: 16 as number,
  },
})(({ title, description, children, fields, gap }) => {
  // fields.left: ReactNode ✓
  // fields.right: ReactNode ✓
  const leftSlot: React.ReactNode = fields!.left;
  const rightSlot: React.ReactNode = fields!.right;

  // @ts-expect-error — 'center' does not exist
  const bad = fields!.center;

  return null as any;
});

// ============================================================
// 4. Object container
// ============================================================

const AddressGroup = defineComponent({
  type: "object",
  properties: {
    province: { type: "string" },
    city: { type: "string" },
    detail: { type: "string" },
  },
  props: {
    columns: 2 as number,
  },
})(({ field, title, description, children, fields, columns }) => {
  // field: IField ✓
  // fields.province: ReactNode ✓
  const provinceSlot: React.ReactNode = fields!.province;

  // @ts-expect-error — 'zip' does not exist
  const bad = fields!.zip;

  return null as any;
});

// ============================================================
// 5. Decorator
// ============================================================

const InlineFormItem = defineComponent.decorator({
  props: {
    labelWidth: 96 as number,
    direction: "horizontal" as "horizontal" | "vertical",
  },
})(({ label, required, errors, warnings, description, validateStatus, children, labelWidth, direction }) => {
  // label?: string ✓
  // errors?: FieldError[] ✓
  // labelWidth: number ✓
  // direction: "horizontal" | "vertical" ✓
  return null as any;
});

// ============================================================
// 6. Array with items.properties (nested object items)
// ============================================================

const SkuTable = defineComponent({
  type: "array",
  items: {
    properties: {
      price: { type: "number" },
      stock: { type: "number" },
      enabled: { type: "boolean" },
    },
  } as any, // This tests the items-as-FieldDef branch
  props: {
    specFields: [] as string[],
  },
})(({ rows, rowFields, field, onAdd, onRemove, specFields }) => {
  return null as any;
});

// Ensure components are assignable to React.FC<any> (for ComponentMap)
const _components: Record<string, React.FC<any>> = {
  ImageInput,
  ContactCards,
  TwoColumnCard,
  AddressGroup,
  SkuTable,
};

const _decorators: Record<string, React.FC<any>> = {
  InlineFormItem,
};
