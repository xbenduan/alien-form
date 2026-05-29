/**
 * @alien-form/react — React bindings for AlienForm
 *
 * Provides React hooks, context providers, and schema-driven rendering.
 * React projects should depend ONLY on this package.
 */

import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import type React from "react";
import type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FormConfig,
  FormError,
  FieldError,
  FieldMutableState,
  EffectOptions,
  EffectContext,
} from "@alien-form/core";
import { createForm, resolveSchemaRef, toFieldPath, toFieldSegments } from "@alien-form/core";
import type { FieldPath } from "@alien-form/core";

// ============================================================
// Re-export core types so consumers don't need @alien-form/core
// ============================================================

export type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FormConfig,
  FormError,
  FieldError,
  FieldMutableState,
  EffectOptions,
  EffectContext,
  ValidateStatus,
  FieldDisplayTypes,
  RuntimeRuleHandler,
  RuntimeRuleHandlerContext,
  DataSourcePolicy,
  SchemaTypes,
} from "@alien-form/core";

export { createForm } from "@alien-form/core";
export { toFieldPath, toFieldSegments } from "@alien-form/core";
export type { FieldPath } from "@alien-form/core";

// ============================================================
// Component/Decorator Maps
// ============================================================

export type ComponentMap = Record<string, React.ComponentType<any>>;
export type DecoratorMap = Record<string, React.ComponentType<any>>;

// ============================================================
// Contexts
// ============================================================

interface FormContextValue {
  form: IForm;
  components: ComponentMap;
  decorators: DecoratorMap;
}

const FormContext = createContext<FormContextValue | null>(null);
const FieldContext = createContext<IField | null>(null);

export { FormContext, FieldContext };

// ============================================================
// useCreateForm — creates and manages form lifecycle
// ============================================================

/**
 * Creates an IForm instance managed by React lifecycle.
 * The form is stable across renders and destroyed on unmount.
 *
 * @example
 * const form = useCreateForm({ initialValues: { name: '' } });
 */
export function useCreateForm(config: FormConfig = {}): IForm {
  const configRef = useRef(config);
  configRef.current = config;

  const formRef = useRef<IForm | null>(null);
  if (!formRef.current) {
    formRef.current = createForm(configRef.current);
  }

  useEffect(() => {
    return () => {
      formRef.current?.destroy();
      formRef.current = null;
    };
  }, []);

  return formRef.current;
}

// ============================================================
// useForm — access form from context
// ============================================================

/**
 * Access the IForm instance from the nearest FormProvider.
 * Throws if used outside FormProvider.
 */
export function useForm(): IForm {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("[alien-form] useForm must be used within <FormProvider>");
  return ctx.form;
}

// ============================================================
// useFormState — reactive form-level state
// ============================================================

export interface FormState {
  values: Record<string, any>;
  initialValues: Record<string, any>;
  valid: boolean;
  invalid: boolean;
  submitting: boolean;
  errors: FieldError[];
}

/**
 * Subscribe to form-level state changes (values, validity, errors).
 * Uses useState + useEffect with form.subscribe for safe reactivity.
 */
export function useFormState(): FormState {
  const form = useForm();

  const getSnapshot = () => ({
    values: form.values,
    initialValues: form.initialValues,
    valid: form.valid,
    invalid: form.invalid,
    submitting: form.submitting,
    errors: form.errors,
  });

  const [state, setState] = useState(getSnapshot);

  useEffect(() => {
    setState(getSnapshot());
    return form.subscribe(() => setState(getSnapshot()));
  }, [form]);

  return state;
}

// ============================================================
// useField — access a field by path with reactive subscription
// ============================================================

/**
 * Access and subscribe to a field by path. Returns null if field doesn't exist.
 * If no path is provided, inherits from the nearest FieldContext.
 *
 * Uses field-level subscription when the field exists for efficiency,
 * and falls back to form-level subscription only to detect field
 * appearance/disappearance.
 */
export function useField(path?: string): IField | null {
  const ctx = useContext(FormContext);
  const parentField = useContext(FieldContext);

  const resolvedPath = path || parentField?.path;

  const [field, setField] = useState<IField | null>(() =>
    ctx && resolvedPath ? ctx.form.getField(resolvedPath) || null : null,
  );

  useEffect(() => {
    if (!ctx || !resolvedPath) {
      setField(null);
      return;
    }

    const currentField = ctx.form.getField(resolvedPath) || null;
    setField(currentField);

    const cleanups: Array<() => void> = [];

    // Field-level subscription: efficient per-field reactivity
    if (currentField) {
      cleanups.push(currentField.subscribe(() => {
        // Force re-render by setting the same reference — the consumer
        // reads field.value / field.errors etc. directly, so identity is enough.
        setField(currentField);
      }));
    }

    // Form-level subscription: detect field appearance / disappearance only
    cleanups.push(ctx.form.subscribe(() => {
      const latest = ctx.form.getField(resolvedPath) || null;
      setField((prev) => {
        if (prev === latest) return prev;
        return latest;
      });
    }));

    return () => cleanups.forEach((fn) => fn());
  }, [ctx, resolvedPath]);

  return field;
}

// ============================================================
// useFieldState — fine-grained field state access
// ============================================================

export interface FieldState {
  value: any;
  display: "visible" | "hidden" | "none";
  visible: boolean;
  hidden: boolean;
  disabled: boolean;
  required: boolean;
  errors: FieldError[];
  warnings: FieldError[];
  validateStatus: "success" | "error" | "warning" | "validating" | "";
  title: string;
  description: string;
  loading: boolean;
  dataSource: Array<{ label: string; value: any }>;
}

/**
 * Returns a snapshot of the field's current state. Triggers re-render on change.
 */
export function useFieldState(path?: string): FieldState | null {
  const field = useField(path);
  if (!field) return null;
  return {
    value: field.value,
    display: field.display,
    visible: field.visible,
    hidden: field.hidden,
    disabled: field.disabled,
    required: field.required,
    errors: field.errors,
    warnings: field.warnings,
    validateStatus: field.validateStatus,
    title: field.title,
    description: field.description,
    loading: field.loading,
    dataSource: field.dataSource,
  };
}

// ============================================================
// useArrayField — array field operations
// ============================================================

export interface ArrayFieldAPI {
  field: IField | null;
  items: IField[][];
  push: (initialValues?: Record<string, any>) => void;
  remove: (index: number) => void;
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
}

/**
 * Access array field with convenience mutation methods.
 */
export function useArrayField(path: string): ArrayFieldAPI {
  const field = useField(path);

  return {
    field,
    items: field?.arrayItems || [],
    push: (initialValues?: Record<string, any>) => field?.push(initialValues),
    remove: (index: number) => field?.remove(index),
    moveUp: (index: number) => field?.moveUp(index),
    moveDown: (index: number) => field?.moveDown(index),
  };
}

// ============================================================
// useArrayRows — reactive array length for custom array components
// ============================================================

/**
 * Returns the current row count of an array field, automatically
 * re-rendering when items are added or removed.
 *
 * Replaces the 8-line useState+useEffect+subscribe boilerplate
 * that every custom array component previously needed.
 *
 * @example
 * function Specs({ field }) {
 *   const count = useArrayRows(field);
 *   return Array.from({ length: count }, (_, i) => (
 *     <Card key={i}>...</Card>
 *   ));
 * }
 */
export function useArrayRows(field: IField): number {
  const getCount = () => (Array.isArray(field.value) ? field.value.length : 0);
  const [count, setCount] = useState(getCount);

  useEffect(() => {
    setCount(getCount());
    return field.subscribe(() => setCount(getCount()));
  }, [field]);

  return count;
}

// ============================================================
// useFormEffect — declarative form-level effects
// ============================================================

/**
 * Run an effect that re-executes when its reactive dependencies change.
 * Automatically cleaned up on unmount.
 *
 * @example
 * useFormEffect((form) => {
 *   console.log('values changed:', form.values);
 * });
 */
export function useFormEffect(
  runner: (form: IForm, ctx: EffectContext) => void | (() => void),
): void {
  const form = useForm();
  const runnerRef = useRef(runner);
  runnerRef.current = runner;

  useEffect(() => {
    return form.effect((f, ctx) => runnerRef.current(f, ctx));
  }, [form]);
}

/**
 * Run a selector-based effect that fires when the selected value changes.
 *
 * @example
 * useFormWatch(
 *   (form) => form.getField('country')?.value,
 *   (country, prev) => console.log(`Country changed: ${prev} -> ${country}`)
 * );
 */
export function useFormWatch<T>(
  selector: (form: IForm) => T,
  listener: (value: T, prevValue: T | undefined, ctx: EffectContext) => void,
  options?: EffectOptions<T>,
): void {
  const form = useForm();
  const selectorRef = useRef(selector);
  const listenerRef = useRef(listener);
  selectorRef.current = selector;
  listenerRef.current = listener;

  useEffect(() => {
    return form.effect(
      (f) => selectorRef.current(f),
      (val, prev, ctx) => listenerRef.current(val, prev, ctx),
      options,
    );
  }, [form, options?.immediate, options?.equals]);
}

// ============================================================
// useFormErrors — subscribe to form-level error events
// ============================================================

/**
 * Subscribe to non-fatal runtime errors from reactions/format/validators.
 */
export function useFormErrors(listener: (error: FormError) => void): void {
  const form = useForm();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    return form.onError((err) => listenerRef.current(err));
  }, [form]);
}

// ============================================================
// useFormSubmit — submit helper with loading state
// ============================================================

export interface SubmitState<T = any> {
  submit: (onSubmit?: (values: Record<string, any>) => T | Promise<T>) => Promise<T>;
  submitting: boolean;
}

/**
 * Provides a submit function and submitting state.
 */
export function useFormSubmit<T = any>(): SubmitState<T> {
  const form = useForm();
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (onSubmit?: (values: Record<string, any>) => T | Promise<T>) => {
      setSubmitting(true);
      try {
        return await form.submit(onSubmit);
      } finally {
        setSubmitting(false);
      }
    },
    [form],
  );

  return { submit, submitting };
}

// ============================================================
// useFormValidate — validate helper
// ============================================================

/**
 * Provides a validate function and validation result state.
 */
export function useFormValidate() {
  const form = useForm();
  const [validating, setValidating] = useState(false);

  const validate = useCallback(async () => {
    setValidating(true);
    try {
      return await form.validate();
    } finally {
      setValidating(false);
    }
  }, [form]);

  return { validate, validating };
}

// ============================================================
// useRenderField — on-demand field rendering for custom components
// ============================================================

/**
 * Options for renderField to control rendering behavior.
 */
export interface RenderFieldOptions {
  /** Set to false to render without the decorator (e.g. FormItem) wrapper. */
  decorator?: boolean;
}

/**
 * Returns a render function that produces framework-managed field UI for a
 * given path.  Designed for custom array / object / void components that need
 * fine-grained control over *where* child fields appear while still
 * delegating *how* they look to the component & decorator registries.
 *
 * Each call returns a self-subscribing React element that re-renders
 * automatically when the underlying field state changes.
 *
 * @example
 * function Specs({ field }) {
 *   const renderField = useRenderField();
 *   return field.value.map((_, i) => (
 *     <Card key={i}>
 *       {renderField([field.path, i, "name"])}
 *       {renderField([field.path, i, "price"], { decorator: false })}
 *     </Card>
 *   ));
 * }
 */
export function useRenderField() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("[alien-form] useRenderField must be used within <FormProvider>");

  return useCallback(
    (path: FieldPath, options?: RenderFieldOptions): React.ReactNode => {
      const resolvedPath = toFieldPath(path);
      const skipDecorator = options?.decorator === false;
      return <FieldNode key={resolvedPath} path={resolvedPath} skipDecorator={skipDecorator} />;
    },
    [],
  );
}

// ============================================================
// FieldNode — unified field rendering component (single source of truth)
// ============================================================

/**
 * Internal component that renders a single field with:
 * - Self-subscription via field.subscribe()
 * - Display checks (none / hidden)
 * - Component + Decorator resolution from FormContext
 * - Leaf vs array props assembly
 * - FieldContext.Provider wrapping
 *
 * Used by useRenderField, FieldRenderer (schema-driven leaf),
 * and ArrayFieldRenderer (schema-driven array).
 */
interface FieldNodeProps {
  path: string;
  /** Skip the decorator wrapper (e.g. FormItem). Useful for inline fields. */
  skipDecorator?: boolean;
  /** Fallback content when no component is registered (used by array fallback). */
  fallback?: React.ReactNode;
}

const FieldNode: React.FC<FieldNodeProps> = ({ path, skipDecorator, fallback }) => {
  const ctx = useContext(FormContext);
  if (!ctx) return null;

  const { form, components, decorators } = ctx;
  const [, forceRender] = useState(0);

  const field = form.getField(path);

  useEffect(() => {
    if (!field) return;
    return field.subscribe(() => forceRender((v) => v + 1));
  }, [field]);

  if (!field) return null;
  if (field.display === "none") return null;
  if (field.display === "hidden") return <div style={{ display: "none" }} />;

  const Component = components[field.component];
  const Decorator = skipDecorator ? undefined : decorators[field.decorator];

  // --- Build component props ---
  let componentProps: Record<string, any>;

  if (field.isArrayField) {
    // Array fields get field + mutation callbacks
    componentProps = {
      ...field.componentProps,
      field,
      onAdd: (initialValues?: Record<string, any>) => field.push(initialValues),
      onRemove: (index: number) => field.remove(index),
      onMoveUp: (index: number) => field.moveUp(index),
      onMoveDown: (index: number) => field.moveDown(index),
      disabled: field.disabled,
    };
  } else {
    // Leaf fields get value + onChange
    componentProps = {
      ...field.componentProps,
      value: field.value,
      onChange: (val: any) => field.setValue(val),
      disabled: field.disabled,
      loading: field.loading,
    };
    if (field.dataSource.length > 0) {
      componentProps.dataSource = field.dataSource;
    }
  }

  // --- Build decorator props ---
  const decoratorProps = Decorator
    ? {
        label: field.title,
        required: field.required,
        errors: field.errors,
        warnings: field.warnings,
        description: field.description,
        validateStatus: field.validateStatus,
        ...field.decoratorProps,
      }
    : undefined;

  // --- Render ---
  const rendered = Component
    ? <Component {...componentProps} />
    : (fallback ?? null);

  if (!rendered) return null;

  return (
    <FieldContext.Provider value={field}>
      {Decorator && decoratorProps
        ? <Decorator {...decoratorProps}>{rendered}</Decorator>
        : rendered}
    </FieldContext.Provider>
  );
};

// ============================================================
// FormProvider
// ============================================================

interface FormProviderProps {
  form: IForm;
  components?: ComponentMap;
  decorators?: DecoratorMap;
  destroyOnUnmount?: boolean;
  children?: React.ReactNode;
}

export const FormProvider: React.FC<FormProviderProps> = ({
  form,
  components: rawComponents = {},
  decorators: rawDecorators = {},
  destroyOnUnmount = false,
  children,
}) => {
  // Stabilize component/decorator maps via refs — prevents context invalidation
  // when parent re-renders with inline `components={{ Input }}` objects.
  const compRef = useRef(rawComponents);
  const decoRef = useRef(rawDecorators);
  compRef.current = rawComponents;
  decoRef.current = rawDecorators;

  const value = useMemo(() => ({
    form,
    get components() { return compRef.current; },
    get decorators() { return decoRef.current; },
  }), [form]);

  useEffect(() => {
    if (!destroyOnUnmount) return;
    return () => {
      form.destroy();
    };
  }, [form, destroyOnUnmount]);

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

// ============================================================
// SchemaField — schema-driven rendering
// ============================================================

interface SchemaFieldProps {
  schema: IFormSchema;
}

export const SchemaField: React.FC<SchemaFieldProps> = ({ schema }) => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("[alien-form] SchemaField must be used within <FormProvider>");

  const { form } = ctx;
  const resolvedSchema = useMemo(() => resolveSchemaRefs(schema), [schema]);

  const [, forceRender] = useState(0);
  const lastAppliedSchemaRef = useRef<{ form: IForm | null; schema: IFormSchema | null }>({
    form: null,
    schema: null,
  });
  useEffect(() => {
    // Fast path: same reference → skip expensive areDeepEqual
    if (
      lastAppliedSchemaRef.current.form === form &&
      lastAppliedSchemaRef.current.schema === schema
    ) {
      return;
    }
    if (
      lastAppliedSchemaRef.current.form === form &&
      areDeepEqual(lastAppliedSchemaRef.current.schema, schema)
    ) {
      lastAppliedSchemaRef.current = { form, schema };
      return;
    }
    form.setSchema(schema);
    lastAppliedSchemaRef.current = { form, schema };
    forceRender((v) => v + 1);
  }, [form, schema]);

  if (!resolvedSchema.properties) return null;

  const sortedEntries = getSortedEntries(resolvedSchema.properties);

  return (
    <>
      {sortedEntries.map(([key, fieldSchema]) => (
        <SchemaFieldItem
          key={key}
          path={key}
          schema={fieldSchema}
          parentPath=""
        />
      ))}
    </>
  );
};

// ============================================================
// Internal Rendering Components
// ============================================================

interface SchemaFieldItemProps {
  path: string;
  schema: IFieldSchema;
  parentPath: string;
}

const SchemaFieldItem: React.FC<SchemaFieldItemProps> = ({
  path,
  schema,
  parentPath,
}) => {
  const ctx = useContext(FormContext);
  if (!ctx) return null;

  const { form, components, decorators } = ctx;
  const fullPath = parentPath ? `${parentPath}.${path}` : path;
  const field = form.getField(fullPath);

  // Void nodes — layout containers
  if (schema.type === "void" && schema.properties) {
    const LayoutComponent = schema.component ? components[schema.component] : null;
    const componentProps = {
      ...schema.props,
      title: schema.title,
      description: schema.description,
    };

    const preservesOwnPath = parentPath !== "" || path !== fullPath || (schema as Record<string, unknown>)[REF_RESOLVED_KEY] === true;
    const voidChildParentPath = preservesOwnPath ? fullPath : parentPath;

    const children = useMemo(() => {
      const sortedChildren = getSortedEntries(schema.properties!);
      return sortedChildren.map(([key, childSchema]) => (
        <SchemaFieldItem
          key={key}
          path={key}
          schema={childSchema}
          parentPath={voidChildParentPath}
        />
      ));
    }, [schema.properties, voidChildParentPath]);

    if (LayoutComponent) {
      return <LayoutComponent {...componentProps}>{children}</LayoutComponent>;
    }
    return <>{children}</>;
  }

  // Object nodes with component
  if (schema.type === "object" && schema.properties && schema.component) {
    if (!field) return null;
    const ObjectComponent = components[schema.component];
    const Decorator = decorators[schema.decorator || ""];

    const children = useMemo(() => {
      const sortedChildren = getSortedEntries(schema.properties!);
      return sortedChildren.map(([key, childSchema]) => (
        <SchemaFieldItem
          key={key}
          path={key}
          schema={childSchema}
          parentPath={fullPath}
        />
      ));
    }, [schema.properties, fullPath]);

    if (ObjectComponent) {
      const objectProps = {
        ...field.componentProps,
        field,
        title: field.title,
        description: field.description,
      };
      const decoratorProps = {
        label: field.title,
        required: field.required,
        errors: field.errors,
        warnings: field.warnings,
        description: field.description,
        validateStatus: field.validateStatus,
        ...field.decoratorProps,
      };
      const rendered = <ObjectComponent {...objectProps}>{children}</ObjectComponent>;
      return (
        <FieldContext.Provider value={field}>
          {Decorator ? <Decorator {...decoratorProps}>{rendered}</Decorator> : rendered}
        </FieldContext.Provider>
      );
    }

    return <>{children}</>;
  }

  // Object nodes with children but no component
  if (schema.type === "object" && schema.properties && !schema.component) {
    const sortedChildren = getSortedEntries(schema.properties);
    return (
      <>
        {sortedChildren.map(([key, childSchema]) => (
          <SchemaFieldItem
            key={key}
            path={key}
            schema={childSchema}
            parentPath={fullPath}
          />
        ))}
      </>
    );
  }

  // Array field
  if (schema.type === "array" && schema.items && !Array.isArray(schema.items) && schema.items.properties) {
    if (!field) return null;
    return (
      <ArrayFieldSchemaRenderer
        field={field}
        schema={schema}
        fullPath={fullPath}
      />
    );
  }

  // Leaf field — delegate to unified FieldNode
  if (!field) return null;
  return <FieldNode path={fullPath} />;
};

// --- ArrayFieldSchemaRenderer ---
// Handles the schema-driven array case: delegates to FieldNode for the
// registered component path, or renders a fallback list.

interface ArrayFieldSchemaRendererProps {
  field: IField;
  schema: IFieldSchema;
  fullPath: string;
}

const ArrayFieldSchemaRenderer: React.FC<ArrayFieldSchemaRendererProps> = ({
  field,
  schema,
  fullPath,
}) => {
  const ctx = useContext(FormContext);
  if (!ctx) return null;

  const { components, decorators } = ctx;
  const ArrayComponent = components[field.component];

  // If a custom array component is registered, use FieldNode (unified path)
  if (ArrayComponent) {
    return <FieldNode path={fullPath} />;
  }

  // Fallback: simple list rendering when no ArrayComponent is registered
  const itemSchema = schema.items as IFieldSchema | undefined;
  return (
    <FieldNode
      path={fullPath}
      fallback={
        <ArrayFallbackContent
          field={field}
          itemSchema={itemSchema}
          fullPath={fullPath}
        />
      }
    />
  );
};

// --- ArrayFallbackContent ---
// Extracted fallback rendering for arrays without a registered component.

interface ArrayFallbackContentProps {
  field: IField;
  itemSchema: IFieldSchema | undefined;
  fullPath: string;
}

const ArrayFallbackContent: React.FC<ArrayFallbackContentProps> = ({
  field,
  itemSchema,
  fullPath,
}) => {
  const arrayValue = Array.isArray(field.value) ? field.value : [];

  const fallbackRows = arrayValue.map((_: any, index: number) => {
    const children: React.ReactNode[] = [];
    if (itemSchema?.properties) {
      const sortedProps = getSortedEntries(itemSchema.properties);
      for (const [childKey, childSchema] of sortedProps) {
        children.push(
          <SchemaFieldItem
            key={childKey}
            path={childKey}
            schema={childSchema}
            parentPath={`${fullPath}.${index}`}
          />,
        );
      }
    }
    return children;
  });

  return (
    <div className="space-y-3">
      {fallbackRows.map((rowChildren, index) => (
        <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
          <div className="flex-1 space-y-2">{rowChildren}</div>
          {!field.disabled && (
            <button
              type="button"
              className="text-destructive text-xs mt-2"
              onClick={() => field.remove(index)}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {!field.disabled && (
        <button
          type="button"
          className="text-primary text-sm"
          onClick={() => field.push()}
        >
          + Add Item
        </button>
      )}
    </div>
  );
};

// ============================================================
// Internal constants
// ============================================================

/** Marks schemas that were resolved from a $ref definition. */
const REF_RESOLVED_KEY = "__alien_ref_resolved";

// ============================================================
// Helpers
// ============================================================

function getSortedEntries(properties: Record<string, IFieldSchema>): [string, IFieldSchema][] {
  return Object.entries(properties).sort(([, a], [, b]) => {
    const ai = a?.order ?? Infinity;
    const bi = b?.order ?? Infinity;
    return ai - bi;
  });
}

function resolveSchemaRefs(schema: IFormSchema): IFormSchema {
  const definitions = schema.definitions || {};
  return {
    ...schema,
    properties: schema.properties
      ? resolveProperties(schema.properties, definitions)
      : schema.properties,
  };
}

function resolveProperties(
  properties: Record<string, IFieldSchema>,
  definitions: Record<string, IFieldSchema>,
): Record<string, IFieldSchema> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, fieldSchema]) => [
      key,
      resolveFieldSchemaTree(fieldSchema, definitions),
    ]),
  );
}

/**
 * Recursively resolve $ref, properties, and items in a field schema tree.
 * Uses core's resolveSchemaRef for the $ref resolution step.
 */
function resolveFieldSchemaTree(
  schema: IFieldSchema,
  definitions: Record<string, IFieldSchema>,
  seen: Set<string> = new Set(),
): IFieldSchema {
  if (!schema || typeof schema !== "object") return schema;

  const { schema: resolved, fromRef } = resolveSchemaRef(schema, definitions, undefined, seen);

  let result = resolved;

  if (resolved.properties) {
    result = {
      ...result,
      properties: resolveProperties(resolved.properties, definitions),
    };
  }

  if (resolved.items) {
    result = {
      ...result,
      items: Array.isArray(resolved.items)
        ? resolved.items.map((item: IFieldSchema) => resolveFieldSchemaTree(item, definitions, seen))
        : resolveFieldSchemaTree(resolved.items as IFieldSchema, definitions, seen),
    };
  }

  return fromRef ? { ...result, [REF_RESOLVED_KEY]: true } as IFieldSchema : result;
}

function areDeepEqual(a: any, b: any, seen: WeakMap<object, object> = new WeakMap()): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;

  if (seen.get(a) === b) return true;
  seen.set(a, b);

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let index = 0; index < a.length; index++) {
      if (!areDeepEqual(a[index], b[index], seen)) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!areDeepEqual(a[key], b[key], seen)) return false;
  }
  return true;
}
