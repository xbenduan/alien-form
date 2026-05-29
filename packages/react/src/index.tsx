/**
 * @alien-form/react — Atomic signal bindings for React
 *
 * Core principle: each React component subscribes ONLY to the specific
 * signals it reads. No version bumps, no snapshot objects, no deep equal.
 *
 * Total: ~280 lines (down from ~990)
 */

import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  memo,
} from "react";
import type React from "react";
import { effect, signal as createSignal } from "@alien-form/core";
import type {
  Signal,
  Computed,
  FormInstance,
  FormConfig,
  FieldAtoms,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldDisplayTypes,
  DataSourceItem,
  ValidateStatus,
} from "@alien-form/core";
import { createForm, sortByOrder } from "@alien-form/core";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — consumers only need @alien-form/react
// ═══════════════════════════════════════════════════════════════════════════════

export { createForm } from "@alien-form/core";
export type {
  Signal,
  Computed,
  FormInstance,
  FormConfig,
  FieldAtoms,
  IFormSchema,
  IFieldSchema,
  FieldError,
  DataSourceItem,
  FieldDisplayTypes,
  ValidateStatus,
  SchemaXRule,
  SchemaRuleSet,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  SchemaReactionKey,
  RuntimeRuleHandler,
  RuntimeRuleHandlerContext,
  SchemaValidate,
  DataSourcePolicy,
  SchemaTypes,
  FormError,
  FormErrorScope,
} from "@alien-form/core";

// ═══════════════════════════════════════════════════════════════════════════════
// Core Primitive: useSignalValue — subscribe to ONE signal atom
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to a single alien-signal and return its current value.
 * Only re-renders when THIS specific signal changes.
 * This is the fundamental building block — all other hooks compose on top.
 */
export function useSignalValue<T>(sig: Signal<T> | Computed<T>): T {
  const sigRef = useRef(sig);
  sigRef.current = sig;

  const subscribe = useCallback((notify: () => void) => {
    return effect(() => {
      sigRef.current();
      notify();
    });
  }, []);

  return useSyncExternalStore(subscribe, () => sigRef.current());
}

// ═══════════════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════════════

export type ComponentMap = Record<string, React.ComponentType<any>>;
export type DecoratorMap = Record<string, React.ComponentType<any>>;

interface FormContextValue {
  form: FormInstance;
  components: ComponentMap;
  decorators: DecoratorMap;
}

const FormContext = createContext<FormContextValue | null>(null);
export { FormContext };

// ═══════════════════════════════════════════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/** Create and manage a form instance tied to React lifecycle */
export function useCreateForm(config: FormConfig = {}): FormInstance {
  const formRef = useRef<FormInstance | null>(null);
  if (!formRef.current) formRef.current = createForm(config);
  useEffect(() => () => { formRef.current?.destroy(); }, []);
  return formRef.current;
}

/** Access form from context */
export function useForm(): FormInstance {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("[alien-form] useForm must be inside <FormProvider>");
  return ctx.form;
}

/** Get a field's atoms by path (subscribes to field registry for existence) */
export function useFieldAtoms(path: string): FieldAtoms | undefined {
  const form = useForm();
  const fields = useSignalValue(form.fields);
  return fields.get(path);
}

/** Subscribe to a single field property */
export function useFieldValue(path: string): any {
  const atoms = useFieldAtoms(path);
  return useSignalValue(atoms?.value ?? nullSignal);
}

export function useFieldErrors(path: string): FieldError[] {
  const atoms = useFieldAtoms(path);
  return useSignalValue(atoms?.errors ?? emptyArraySignal) as FieldError[];
}

export function useFieldDisplay(path: string): FieldDisplayTypes {
  const atoms = useFieldAtoms(path);
  return useSignalValue(atoms?.display ?? visibleSignal) as FieldDisplayTypes;
}

export function useFieldDisabled(path: string): boolean {
  const atoms = useFieldAtoms(path);
  return useSignalValue(atoms?.disabled ?? falseSignal);
}

export function useFieldRequired(path: string): boolean {
  const atoms = useFieldAtoms(path);
  return useSignalValue(atoms?.required ?? falseSignal);
}

export function useFieldLoading(path: string): boolean {
  const atoms = useFieldAtoms(path);
  return useSignalValue(atoms?.loading ?? falseSignal);
}

/** Subscribe to form-level values */
export function useFormValues(): Record<string, any> {
  const form = useForm();
  return useSignalValue(form.values);
}

export function useFormValid(): boolean {
  const form = useForm();
  return useSignalValue(form.valid);
}

export function useFormSubmitting(): boolean {
  const form = useForm();
  return useSignalValue(form.submitting);
}

export function useFormErrors(): FieldError[] {
  const form = useForm();
  return useSignalValue(form.errors);
}

/** Submit helper */
export function useFormSubmit<T = any>() {
  const form = useForm();
  const submitting = useSignalValue(form.submitting);
  const submit = useCallback(
    (onSubmit?: (values: Record<string, any>) => T | Promise<T>) => form.submit(onSubmit),
    [form],
  );
  return { submit, submitting };
}

/** Validate helper */
export function useFormValidate() {
  const form = useForm();
  const validate = useCallback(() => form.validate(), [form]);
  return { validate };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FormProvider
// ═══════════════════════════════════════════════════════════════════════════════

interface FormProviderProps {
  form: FormInstance;
  components?: ComponentMap;
  decorators?: DecoratorMap;
  children?: React.ReactNode;
}

export const FormProvider: React.FC<FormProviderProps> = ({
  form,
  components = {},
  decorators = {},
  children,
}) => {
  const compRef = useRef(components);
  const decoRef = useRef(decorators);
  compRef.current = components;
  decoRef.current = decorators;

  const value = useMemo(() => ({
    form,
    get components() { return compRef.current; },
    get decorators() { return decoRef.current; },
  }), [form]);

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SchemaField — schema-driven rendering
// ═══════════════════════════════════════════════════════════════════════════════

interface SchemaFieldProps {
  schema: IFormSchema;
}

export const SchemaField: React.FC<SchemaFieldProps> = ({ schema }) => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("[alien-form] SchemaField must be inside <FormProvider>");
  const { form } = ctx;

  // Let core handle schema — only call setSchema when schema changes
  const lastSchemaRef = useRef<IFormSchema | null>(null);
  if (lastSchemaRef.current !== schema) {
    lastSchemaRef.current = schema;
    form.setSchema(schema);
  }

  return <SchemaProperties schema={schema} parentPath="" />;
};

// ─── Internal Renderers ─────────────────────────────────────────────────────

const SchemaProperties: React.FC<{
  schema: IFormSchema | IFieldSchema;
  parentPath: string;
}> = ({ schema, parentPath }) => {
  const properties = (schema as any).properties as Record<string, IFieldSchema> | undefined;
  if (!properties) return null;

  const sorted = sortByOrder(properties);
  return (
    <>
      {sorted.map(([key, fieldSchema]) => (
        <SchemaFieldItem key={key} fieldKey={key} schema={fieldSchema} parentPath={parentPath} />
      ))}
    </>
  );
};

const SchemaFieldItem: React.FC<{
  fieldKey: string;
  schema: IFieldSchema;
  parentPath: string;
}> = memo(({ fieldKey, schema, parentPath }) => {
  const ctx = useContext(FormContext)!;
  const { form, components, decorators } = ctx;
  const fullPath = parentPath ? `${parentPath}.${fieldKey}` : fieldKey;

  // Void nodes — layout only
  if (schema.type === "void" && schema.properties) {
    const LayoutComponent = schema.component ? components[schema.component] : null;
    const sorted = sortByOrder(schema.properties);
    const children = sorted.map(([k, s]) => (
      <SchemaFieldItem key={k} fieldKey={k} schema={s} parentPath={parentPath} />
    ));

    if (LayoutComponent) {
      return <LayoutComponent title={schema.title} description={schema.description} {...(schema.props || {})}>{children}</LayoutComponent>;
    }
    return <>{children}</>;
  }

  // Object with properties
  if (schema.type === "object" && schema.properties && !schema.component) {
    return <SchemaProperties schema={schema} parentPath={fullPath} />;
  }

  // Array field
  if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) {
    return <ArrayFieldSlot path={fullPath} schema={schema} />;
  }

  // Regular field or object-with-component
  if (schema.type === "object" && schema.properties && schema.component) {
    return <ObjectFieldSlot path={fullPath} schema={schema} />;
  }

  return <FieldSlot path={fullPath} />;
});

// ─── FieldSlot — subscribes only to what it renders ─────────────────────────

const FieldSlot: React.FC<{ path: string }> = memo(({ path }) => {
  const ctx = useContext(FormContext)!;
  const { form, components, decorators } = ctx;
  const atoms = useSignalValue(form.fields).get(path);
  if (!atoms) return null;

  const display = useSignalValue(atoms.display);
  if (display === "none") return null;
  if (display === "hidden") return <div style={{ display: "none" }} />;

  const componentName = useSignalValue(atoms.component);
  const decoratorName = useSignalValue(atoms.decorator);
  const value = useSignalValue(atoms.value);
  const disabled = useSignalValue(atoms.disabled);
  const loading = useSignalValue(atoms.loading);
  const componentProps = useSignalValue(atoms.componentProps);
  const dataSource = useSignalValue(atoms.dataSource);
  const title = useSignalValue(atoms.title);
  const required = useSignalValue(atoms.required);
  const errors = useSignalValue(atoms.errors);
  const warnings = useSignalValue(atoms.warnings);
  const description = useSignalValue(atoms.description);
  const validateStatus = useSignalValue(atoms.validateStatus);
  const decoratorProps = useSignalValue(atoms.decoratorProps);

  const Component = components[componentName];
  const Decorator = decorators[decoratorName];

  if (!Component) return <div style={{ color: "red" }}>{`Unknown: ${componentName}`}</div>;

  const props: Record<string, any> = {
    ...componentProps,
    value,
    onChange: (v: any) => atoms.setValue(v),
    disabled,
    loading,
  };
  if (dataSource.length > 0) props.dataSource = dataSource;

  const rendered = <Component {...props} />;
  if (Decorator) {
    return (
      <Decorator label={title} required={required} errors={errors} warnings={warnings}
        description={description} validateStatus={validateStatus} {...decoratorProps}>
        {rendered}
      </Decorator>
    );
  }
  return rendered;
});

// ─── ArrayFieldSlot ─────────────────────────────────────────────────────────

const ArrayFieldSlot: React.FC<{ path: string; schema: IFieldSchema }> = memo(({ path, schema }) => {
  const ctx = useContext(FormContext)!;
  const { form, components, decorators } = ctx;
  const atoms = useSignalValue(form.fields).get(path);
  if (!atoms) return null;

  const display = useSignalValue(atoms.display);
  if (display === "none") return null;

  const componentName = useSignalValue(atoms.component);
  const decoratorName = useSignalValue(atoms.decorator);
  const disabled = useSignalValue(atoms.disabled);
  const title = useSignalValue(atoms.title);
  const required = useSignalValue(atoms.required);
  const errors = useSignalValue(atoms.errors);
  const warnings = useSignalValue(atoms.warnings);
  const description = useSignalValue(atoms.description);
  const validateStatus = useSignalValue(atoms.validateStatus);
  const componentProps = useSignalValue(atoms.componentProps);
  const decoratorProps = useSignalValue(atoms.decoratorProps);
  const rowCount = useSignalValue(atoms.arrayRows);

  const ArrayComponent = components[componentName];
  const Decorator = decorators[decoratorName];
  const itemSchema = schema.items as IFieldSchema;

  // Build rows
  const rows: React.ReactNode[][] = [];
  const rowFields: Record<string, React.ReactNode>[] = [];

  for (let i = 0; i < rowCount; i++) {
    const children: React.ReactNode[] = [];
    const fieldMap: Record<string, React.ReactNode> = {};
    if (itemSchema.properties) {
      const sorted = sortByOrder(itemSchema.properties);
      for (const [childKey, childSchema] of sorted) {
        const node = <FieldSlot key={childKey} path={`${path}.${i}.${childKey}`} />;
        children.push(node);
        fieldMap[childKey] = node;
      }
    }
    rows.push(children);
    rowFields.push(fieldMap);
  }

  const arrayProps = {
    ...componentProps,
    field: atoms,
    rows,
    rowFields,
    onAdd: (iv?: Record<string, any>) => atoms.push(iv),
    onRemove: (i: number) => atoms.remove(i),
    onMoveUp: (i: number) => atoms.moveUp(i),
    onMoveDown: (i: number) => atoms.moveDown(i),
    disabled,
  };

  const decoProps = {
    label: title, required, errors, warnings, description, validateStatus, ...decoratorProps,
  };

  if (ArrayComponent) {
    const rendered = <ArrayComponent {...arrayProps} />;
    return Decorator ? <Decorator {...decoProps}>{rendered}</Decorator> : rendered;
  }

  // Fallback
  return (
    <div>
      {rows.map((row, i) => <div key={i}>{row}</div>)}
      {!disabled && <button type="button" onClick={() => atoms.push()}>+ Add</button>}
    </div>
  );
});

// ─── ObjectFieldSlot ────────────────────────────────────────────────────────

const ObjectFieldSlot: React.FC<{ path: string; schema: IFieldSchema }> = memo(({ path, schema }) => {
  const ctx = useContext(FormContext)!;
  const { form, components, decorators } = ctx;
  const atoms = useSignalValue(form.fields).get(path);
  if (!atoms) return null;

  const display = useSignalValue(atoms.display);
  if (display === "none") return null;

  const componentName = useSignalValue(atoms.component);
  const decoratorName = useSignalValue(atoms.decorator);
  const componentProps = useSignalValue(atoms.componentProps);
  const title = useSignalValue(atoms.title);
  const description = useSignalValue(atoms.description);

  const ObjectComponent = components[componentName];
  const Decorator = decorators[decoratorName];

  const sorted = schema.properties ? sortByOrder(schema.properties) : [];
  const children = sorted.map(([k, s]) => (
    <SchemaFieldItem key={k} fieldKey={k} schema={s} parentPath={path} />
  ));
  const fieldMap: Record<string, React.ReactNode> = {};
  for (const [k, s] of sorted) {
    fieldMap[k] = <FieldSlot key={k} path={`${path}.${k}`} />;
  }

  if (ObjectComponent) {
    const rendered = (
      <ObjectComponent {...componentProps} field={atoms} fields={fieldMap} title={title} description={description}>
        {children}
      </ObjectComponent>
    );
    if (Decorator) {
      const required = useSignalValue(atoms.required);
      const errors = useSignalValue(atoms.errors);
      return <Decorator label={title} required={required} errors={errors}>{rendered}</Decorator>;
    }
    return rendered;
  }

  return <>{children}</>;
});

// ─── Null signals (fallbacks for missing fields) ────────────────────────────

const nullSignal = createSignal(undefined);
const emptyArraySignal = createSignal([]);
const visibleSignal = createSignal("visible" as FieldDisplayTypes);
const falseSignal = createSignal(false);
