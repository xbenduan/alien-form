/**
 * Type-level test — this file should compile with zero errors when
 * @types/react and @alien-form/core are available.
 *
 * Run: tsc --noEmit --strict --project tsconfig.check-define.json
 */

import type React from "react";
import { defineComponent } from "../define";

// ============================================================
// 1. Normal field component (type: "string") — props via generic
// ============================================================

interface ImageInputProps {
  placeholder?: string;
  previewSize?: number;
}

const ImageInput = defineComponent<{ type: "string" }, ImageInputProps>({
  type: "string",
})(({ value, onChange, disabled, loading, placeholder, previewSize }) => {
  // value: any ✓
  // onChange: (value: any) => void ✓
  // disabled?: boolean ✓
  // placeholder?: string ✓
  // previewSize?: number ✓
  return null as any;
});

// ============================================================
// 2. Array component with typed rowFields — props via generic
// ============================================================

const contactSchema = {
  type: "array" as const,
  items: {
    name: { type: "string" },
    phone: { type: "string" },
    role: { type: "string" },
  },
};

interface ContactCardsProps {
  maxItems?: number;
  addText?: string;
}

const ContactCards = defineComponent<typeof contactSchema, ContactCardsProps>(
  contactSchema,
)(({ rows, rowFields, field, onAdd, onRemove, onMoveUp, onMoveDown, disabled, maxItems, addText }) => {
  // field: IField ✓
  // rows: ReactNode[][] ✓
  // rowFields: { name: ReactNode; phone: ReactNode; role: ReactNode }[] ✓
  // maxItems?: number ✓

  const firstRow = rowFields[0];
  const nameSlot: React.ReactNode = firstRow.name;  // ✓ typed
  const phoneSlot: React.ReactNode = firstRow.phone; // ✓ typed
  const roleSlot: React.ReactNode = firstRow.role;   // ✓ typed

  // @ts-expect-error — 'xxx' does not exist on rowFields item
  const bad = firstRow.xxx;

  return null as any;
});

// ============================================================
// 3. Void layout container with typed fields
// ============================================================

const voidSchema = {
  type: "void" as const,
  properties: {
    left: { type: "string" },
    right: { type: "string" },
  },
};

interface TwoColumnProps {
  gap?: number;
}

const TwoColumnCard = defineComponent<typeof voidSchema, TwoColumnProps>(
  voidSchema,
)(({ title, description, children, fields, gap }) => {
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

const objectSchema = {
  type: "object" as const,
  properties: {
    province: { type: "string" },
    city: { type: "string" },
    detail: { type: "string" },
  },
};

interface AddressGroupProps {
  columns?: number;
}

const AddressGroup = defineComponent<typeof objectSchema, AddressGroupProps>(
  objectSchema,
)(({ field, title, description, children, fields, columns }) => {
  // field: IField ✓
  // fields.province: ReactNode ✓
  const provinceSlot: React.ReactNode = fields!.province;

  // @ts-expect-error — 'zip' does not exist
  const bad = fields!.zip;

  return null as any;
});

// ============================================================
// 5. Decorator — props via generic
// ============================================================

interface InlineFormItemProps {
  labelWidth?: number;
  direction?: "horizontal" | "vertical";
}

const InlineFormItem = defineComponent.decorator<InlineFormItemProps>()(
  ({ label, required, errors, warnings, description, validateStatus, children, labelWidth, direction }) => {
    // label?: string ✓
    // errors?: FieldError[] ✓
    // labelWidth?: number ✓
    // direction?: "horizontal" | "vertical" ✓
    return null as any;
  },
);

// ============================================================
// 6. No custom props — just omit the generic
// ============================================================

const SimpleInput = defineComponent({ type: "string" })(
  ({ value, onChange, disabled }) => {
    return null as any;
  },
);

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
