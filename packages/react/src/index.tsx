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
  useSyncExternalStore,
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
import { createForm } from "@alien-form/core";

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
  Resolved,
  InferRole,
  InferSlots,
  InferCustomProps,
  FieldSlots,
  VoidSlots,
  ObjectSlots,
  ArraySlots,
  DecoratorSlots,
} from "@alien-form/core";

export { createForm, define } from "@alien-form/core";

// ============================================================
// Component/Decorator Maps
// ============================================================

export type ComponentMap = Record<string, React.ComponentType<Record<string, any>>>;
export type DecoratorMap = Record<string, React.ComponentType<Record<string, any>>>;

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
 * Uses React 18 useSyncExternalStore for concurrent-rendering safety.
 */
export function useFormState(): FormState {
  const form = useForm();
  return useSyncExternalStore(
    (onStoreChange: () => void) => form.subscribe(onStoreChange),
    () => ({
      values: form.values,
      initialValues: form.initialValues,
      valid: form.valid,
      invalid: form.invalid,
      submitting: form.submitting,
      errors: form.errors,
    }),
  );
}

// ============================================================
// useField — access a field by path with reactive subscription
// ============================================================

/**
 * Access and subscribe to a field by path. Returns null if field doesn't exist.
 * If no path is provided, inherits from the nearest FieldContext.
 * Uses React 18 useSyncExternalStore for concurrent-rendering safety.
 */
export function useField(path?: string): IField | null {
  const ctx = useContext(FormContext);
  const parentField = useContext(FieldContext);

  const resolvedPath = path || parentField?.path;

  return useSyncExternalStore(
    (onStoreChange: () => void) => (ctx ? ctx.form.subscribe(onStoreChange) : () => {}),
    () => (ctx && resolvedPath ? ctx.form.getField(resolvedPath) || null : null),
  );
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

  const { form, components, decorators } = ctx;
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
          components={components}
          decorators={decorators}
          form={form}
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
  components: ComponentMap;
  decorators: DecoratorMap;
  form: IForm;
  parentPath: string;
}

const SchemaFieldItem: React.FC<SchemaFieldItemProps> = ({
  path,
  schema,
  components,
  decorators,
  form,
  parentPath,
}) => {
  const fullPath = parentPath ? `${parentPath}.${path}` : path;
  const field = form.getField(fullPath);

  // Void nodes — layout containers
  // IMPORTANT:
  // - Plain inline void fields are path-transparent.
  // - But a concrete property that resolves from $ref into a void schema must
  //   keep its own prefix (e.g. profile -> $ref -> void => profile.name).
  if (schema.type === "void" && schema.properties) {
    const LayoutComponent = schema.component ? components[schema.component] : null;
    const componentProps = {
      ...schema.props,
      title: schema.title,
      description: schema.description,
    };

    const preservesOwnPath = parentPath !== "" || path !== fullPath || (schema as Record<string, unknown>)[REF_RESOLVED_KEY] === true;
    const voidChildParentPath = preservesOwnPath ? fullPath : parentPath;

    // Memoize children + fieldMap — avoids rebuilding on every field-value-driven re-render
    const { children, fieldMap } = useMemo(() => {
      const sortedChildren = getSortedEntries(schema.properties!);
      const fieldMap: Record<string, React.ReactNode> = {};
      const children = sortedChildren.map(([key, childSchema]) => {
        const node = (
          <SchemaFieldItem
            key={key}
            path={key}
            schema={childSchema}
            components={components}
            decorators={decorators}
            form={form}
            parentPath={voidChildParentPath}
          />
        );
        fieldMap[key] = node;
        return node;
      });
      return { children, fieldMap };
    }, [schema.properties, voidChildParentPath, components, decorators, form]);

    if (LayoutComponent) {
      return (
        <LayoutComponent {...componentProps} fields={fieldMap}>
          {children}
        </LayoutComponent>
      );
    }
    return <>{children}</>;
  }

  // Object nodes with component — higher-order components (pass fields map)
  if (schema.type === "object" && schema.properties && schema.component) {
    if (!field) return null;
    const ObjectComponent = components[schema.component];
    const Decorator = decorators[schema.decorator || ""];

    // Memoize children + fieldMap — avoids rebuilding on every field-value-driven re-render
    const { children, fieldMap } = useMemo(() => {
      const sortedChildren = getSortedEntries(schema.properties!);
      const fieldMap: Record<string, React.ReactNode> = {};
      const children = sortedChildren.map(([key, childSchema]) => {
        const node = (
          <SchemaFieldItem
            key={key}
            path={key}
            schema={childSchema}
            components={components}
            decorators={decorators}
            form={form}
            parentPath={fullPath}
          />
        );
        fieldMap[key] = node;
        return node;
      });
      return { children, fieldMap };
    }, [schema.properties, fullPath, components, decorators, form]);

    if (ObjectComponent) {
      const objectProps = {
        ...field.componentProps,
        field,
        fields: fieldMap,
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
            components={components}
            decorators={decorators}
            form={form}
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
      <ArrayFieldRenderer
        field={field}
        schema={schema}
        components={components}
        decorators={decorators}
        form={form}
        fullPath={fullPath}
      />
    );
  }

  if (!field) return null;

  return (
    <FieldRenderer
      field={field}
      schema={schema}
      components={components}
      decorators={decorators}
      form={form}
      fullPath={fullPath}
    />
  );
};

// ============================================================
// Safe subscribe wrapper for useSyncExternalStore
// ============================================================
//
// field.subscribe(cb) uses alien-signals' effect() internally:
//   effect(() => { version(); cb(); })
//
// Problem: useSyncExternalStore calls getSnapshot() inside the onStoreChange
// callback (to check consistency). Since onStoreChange runs inside effect(),
// any signal reads in getSnapshot() (field.display, field.value, etc.) get
// tracked by the effect. This means ANY field signal change re-triggers the
// effect → onStoreChange → getSnapshot reads more signals → cascading
// re-renders → Maximum update depth exceeded.
//
// Fix: wrap the listener so it runs outside the effect's tracking scope via
// queueMicrotask. The effect only tracks the version signal (as intended),
// and the React callback runs in a clean context where signal reads are not
// tracked.

function safeFieldSubscribe(field: IField, onStoreChange: () => void): () => void {
  let mounted = true;
  const unsub = field.subscribe(() => {
    if (mounted) {
      // Use queueMicrotask to escape alien-signals effect tracking context.
      // This ensures getSnapshot() signal reads are NOT tracked by the effect.
      queueMicrotask(() => {
        if (mounted) onStoreChange();
      });
    }
  });
  return () => {
    mounted = false;
    unsub();
  };
}

// --- ArrayFieldRenderer ---

interface ArrayFieldRendererProps {
  field: IField;
  schema: IFieldSchema;
  components: ComponentMap;
  decorators: DecoratorMap;
  form: IForm;
  fullPath: string;
}

const ArrayFieldRenderer: React.FC<ArrayFieldRendererProps> = ({
  field,
  schema,
  components,
  decorators,
  form,
  fullPath,
}) => {
  // Use useState + useEffect instead of useSyncExternalStore to avoid
  // alien-signals effect tracking issue with getSnapshot signal reads.
  const [snapshot, setSnapshot] = useState(() => ({
    display: field.display,
    value: field.value,
    component: field.component,
    decorator: field.decorator,
    title: field.title,
    required: field.required,
    errors: field.errors,
    warnings: field.warnings,
    description: field.description,
    validateStatus: field.validateStatus,
    disabled: field.disabled,
    componentProps: field.componentProps,
    decoratorProps: field.decoratorProps,
  }));

  useEffect(() => {
    // Read initial state outside effect tracking
    setSnapshot({
      display: field.display,
      value: field.value,
      component: field.component,
      decorator: field.decorator,
      title: field.title,
      required: field.required,
      errors: field.errors,
      warnings: field.warnings,
      description: field.description,
      validateStatus: field.validateStatus,
      disabled: field.disabled,
      componentProps: field.componentProps,
      decoratorProps: field.decoratorProps,
    });
    return field.subscribe(() => {
      setSnapshot({
        display: field.display,
        value: field.value,
        component: field.component,
        decorator: field.decorator,
        title: field.title,
        required: field.required,
        errors: field.errors,
        warnings: field.warnings,
        description: field.description,
        validateStatus: field.validateStatus,
        disabled: field.disabled,
        componentProps: field.componentProps,
        decoratorProps: field.decoratorProps,
      });
    });
  }, [field]);

  if (snapshot.display === "none") return null;
  if (snapshot.display === "hidden") return <div style={{ display: "none" }} />;

  const ArrayComponent = components[snapshot.component];
  const Decorator = decorators[snapshot.decorator];

  const arrayValue = Array.isArray(snapshot.value) ? snapshot.value : [];
  const itemSchema = schema.items as IFieldSchema | undefined;

  // Memoize rows/rowFields to avoid rebuilding on every render
  const { rows, rowFields } = useMemo(() => {
    const rows: React.ReactNode[][] = [];
    const rowFields: Record<string, React.ReactNode>[] = [];

    arrayValue.forEach((_: any, index: number) => {
      const children: React.ReactNode[] = [];
      const fieldMap: Record<string, React.ReactNode> = {};
      if (itemSchema?.properties) {
        const sortedProps = getSortedEntries(itemSchema.properties);
        for (const [childKey, childSchema] of sortedProps) {
          const node = (
            <SchemaFieldItem
              key={childKey}
              path={childKey}
              schema={childSchema}
              components={components}
              decorators={decorators}
              form={form}
              parentPath={`${fullPath}.${index}`}
            />
          );
          children.push(node);
          fieldMap[childKey] = node;
        }
      }
      rows.push(children);
      rowFields.push(fieldMap);
    });

    return { rows, rowFields };
  }, [arrayValue, itemSchema, components, decorators, form, fullPath]);

  const arrayProps = {
    ...snapshot.componentProps,
    field,
    rows,
    rowFields,
    onAdd: (initialValues?: Record<string, any>) => field.push(initialValues),
    onRemove: (index: number) => field.remove(index),
    onMoveUp: (index: number) => field.moveUp(index),
    onMoveDown: (index: number) => field.moveDown(index),
    disabled: snapshot.disabled,
  };

  const decoratorProps = {
    label: snapshot.title,
    required: snapshot.required,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    description: snapshot.description,
    validateStatus: snapshot.validateStatus,
    ...snapshot.decoratorProps,
  };

  if (ArrayComponent) {
    const rendered = <ArrayComponent {...arrayProps} />;
    return (
      <FieldContext.Provider value={field}>
        {Decorator ? <Decorator {...decoratorProps}>{rendered}</Decorator> : rendered}
      </FieldContext.Provider>
    );
  }

  // Fallback: simple list rendering
  const fallback = (
    <div className="space-y-3">
      {rows.map((rowChildren, index) => (
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

  return (
    <FieldContext.Provider value={field}>
      {Decorator ? <Decorator {...decoratorProps}>{fallback}</Decorator> : fallback}
    </FieldContext.Provider>
  );
};

// --- FieldRenderer ---

interface FieldRendererProps {
  field: IField;
  schema: IFieldSchema;
  components: ComponentMap;
  decorators: DecoratorMap;
  form: IForm;
  fullPath: string;
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, components, decorators }) => {
  // Use useState + useEffect instead of useSyncExternalStore to avoid
  // alien-signals effect tracking issue with getSnapshot signal reads.
  const [snapshot, setSnapshot] = useState(() => ({
    display: field.display,
    component: field.component,
    decorator: field.decorator,
    title: field.title,
    required: field.required,
    errors: field.errors,
    warnings: field.warnings,
    description: field.description,
    validateStatus: field.validateStatus,
    disabled: field.disabled,
    loading: field.loading,
    value: field.value,
    dataSource: field.dataSource,
    componentProps: field.componentProps,
    decoratorProps: field.decoratorProps,
  }));

  useEffect(() => {
    // Read initial state outside effect tracking
    setSnapshot({
      display: field.display,
      component: field.component,
      decorator: field.decorator,
      title: field.title,
      required: field.required,
      errors: field.errors,
      warnings: field.warnings,
      description: field.description,
      validateStatus: field.validateStatus,
      disabled: field.disabled,
      loading: field.loading,
      value: field.value,
      dataSource: field.dataSource,
      componentProps: field.componentProps,
      decoratorProps: field.decoratorProps,
    });
    return field.subscribe(() => {
      setSnapshot({
        display: field.display,
        component: field.component,
        decorator: field.decorator,
        title: field.title,
        required: field.required,
        errors: field.errors,
        warnings: field.warnings,
        description: field.description,
        validateStatus: field.validateStatus,
        disabled: field.disabled,
        loading: field.loading,
        value: field.value,
        dataSource: field.dataSource,
        componentProps: field.componentProps,
        decoratorProps: field.decoratorProps,
      });
    });
  }, [field]);

  if (snapshot.display === "none") return null;
  if (snapshot.display === "hidden") return <div style={{ display: "none" }} />;

  const Component = components[snapshot.component];
  const Decorator = decorators[snapshot.decorator];

  const decoratorProps = {
    label: snapshot.title,
    required: snapshot.required,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    description: snapshot.description,
    validateStatus: snapshot.validateStatus,
    ...snapshot.decoratorProps,
  };

  if (!Component) {
    return (
      <div className="text-destructive text-sm">{`Unknown component: ${snapshot.component}`}</div>
    );
  }

  // Build component props
  const componentProps: Record<string, any> = {
    ...snapshot.componentProps,
    value: snapshot.value,
    onChange: (val: any) => field.setValue(val),
    disabled: snapshot.disabled,
    loading: snapshot.loading,
  };

  if (snapshot.dataSource.length > 0) {
    componentProps.dataSource = snapshot.dataSource;
  }

  const rendered = <Component {...componentProps} />;
  return (
    <FieldContext.Provider value={field}>
      {Decorator ? <Decorator {...decoratorProps}>{rendered}</Decorator> : rendered}
    </FieldContext.Provider>
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
 * Inlines the $ref resolution step (no external dependency).
 */
function resolveFieldSchemaTree(
  schema: IFieldSchema,
  definitions: Record<string, IFieldSchema>,
  seen: Set<string> = new Set(),
): IFieldSchema {
  if (!schema || typeof schema !== "object") return schema;

  // Inline $ref resolution
  let resolved: IFieldSchema = schema;
  let fromRef = false;
  if (typeof (schema as any).$ref === "string") {
    const refPath = ((schema as any).$ref as string).replace(/^#\/definitions\//, "");
    if (!seen.has(refPath) && definitions[refPath]) {
      const { $ref: _ignored, ...localProps } = schema as any;
      void _ignored;
      resolved = {
        ...resolveFieldSchemaTree(definitions[refPath], definitions, new Set([...seen, refPath])),
        ...localProps,
      };
      fromRef = true;
    } else {
      const { $ref: _ignored, ...localProps } = schema as any;
      void _ignored;
      resolved = localProps as IFieldSchema;
    }
  }

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
