/**
 * @alien-form/react — React bindings
 * Enterprise schema protocol inspired by Formily
 */

import { createContext, useContext, useMemo, useEffect, useState, useRef, Fragment } from "react";
import type React from "react";
import type { IForm, IField, IFormSchema } from "@alien-form/core";

export type ComponentMap = Record<string, React.ComponentType<any>>;
export type DecoratorMap = Record<string, React.ComponentType<any>>;

// --- Contexts ---

interface FormContextValue {
  form: IForm;
  components: ComponentMap;
  decorators: DecoratorMap;
}

const FormContext = createContext<FormContextValue | null>(null);
const FieldContext = createContext<IField | null>(null);

// --- Hooks ---

export function useForm(): IForm {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("useForm must be used within FormProvider");
  return ctx.form;
}

export function useField(path?: string): IField | null {
  const ctx = useContext(FormContext);
  const parentField = useContext(FieldContext);

  const resolvedPath = path || parentField?.path;
  const field = ctx && resolvedPath ? ctx.form.getField(resolvedPath) || null : null;

  // Subscribe to field changes (hooks must run unconditionally).
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!field) return;
    return field.subscribe(() => forceRender((v) => v + 1));
  }, [field]);

  if (!ctx) return null;
  return field;
}

export function useFormState() {
  const form = useForm();
  const [, forceRender] = useState(0);

  useEffect(() => {
    return form.subscribe(() => forceRender((v) => v + 1));
  }, [form]);

  return {
    values: form.values,
    valid: form.valid,
    invalid: form.invalid,
    submitting: form.submitting,
    errors: form.errors,
  };
}

export function useArrayField(path: string) {
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

// --- FormProvider ---

interface FormProviderProps {
  form: IForm;
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
  const value = useMemo(() => ({ form, components, decorators }), [form, components, decorators]);
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

// --- SchemaField: renders a form from schema ---

interface SchemaFieldProps {
  schema: IFormSchema;
}

export const SchemaField: React.FC<SchemaFieldProps> = ({ schema }) => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("SchemaField must be used within FormProvider");

  const { form, components, decorators } = ctx;
  const resolvedSchema = useMemo(() => resolveSchemaRefs(schema), [schema]);

  // Initialize or replace fields when schema/form changes. setSchema rebuilds
  // the field registry; force a render afterwards so the first paint includes
  // the freshly created fields rather than waiting for an unrelated update.
  const [, forceRender] = useState(0);
  const lastAppliedSchemaRef = useRef<{ form: IForm | null; schema: IFormSchema | null }>({
    form: null,
    schema: null,
  });
  useEffect(() => {
    if (
      lastAppliedSchemaRef.current.form === form &&
      areDeepEqual(lastAppliedSchemaRef.current.schema, schema)
    ) {
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

interface SchemaFieldItemProps {
  path: string;
  schema: any;
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
  if (schema.type === "void" && schema.properties) {
    const LayoutComponent = schema.component ? components[schema.component] : null;
    const componentProps = {
      ...schema.props,
      title: schema.title,
      description: schema.description,
    };

    const sortedChildren = getSortedEntries(schema.properties);
    const children = sortedChildren.map(([key, childSchema]) => (
      <SchemaFieldItem
        key={key}
        path={key}
        schema={childSchema}
        components={components}
        decorators={decorators}
        form={form}
        parentPath={fullPath}
      />
    ));

    if (LayoutComponent) {
      return <LayoutComponent {...componentProps}>{children}</LayoutComponent>;
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
  if (schema.type === "array" && schema.items?.properties) {
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

// --- ArrayFieldRenderer ---

interface ArrayFieldRendererProps {
  field: IField;
  schema: any;
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
  const [, forceRender] = useState(0);

  useEffect(() => field.subscribe(() => forceRender((v) => v + 1)), [field]);

  if (field.display === "none") return null;
  if (field.display === "hidden") return <div style={{ display: "none" }} />;

  const ArrayComponent = components[field.component];
  const Decorator = decorators[field.decorator];

  const arrayValue = Array.isArray(field.value) ? field.value : [];
  const itemSchema = schema.items;

  // Build rows of rendered child fields
  const rows = arrayValue.map((_: any, index: number) => {
    const rowFields: React.ReactNode[] = [];
    if (itemSchema?.properties) {
      const sortedProps = getSortedEntries(itemSchema.properties);
      for (const [childKey, childSchema] of sortedProps) {
        rowFields.push(
          <SchemaFieldItem
            key={childKey}
            path={childKey}
            schema={childSchema}
            components={components}
            decorators={decorators}
            form={form}
            parentPath={`${fullPath}.${index}`}
          />,
        );
      }
    }
    return rowFields;
  });

  const arrayProps = {
    ...field.componentProps,
    field,
    rows,
    onAdd: (initialValues?: Record<string, any>) => field.push(initialValues),
    onRemove: (index: number) => field.remove(index),
    onMoveUp: (index: number) => field.moveUp(index),
    onMoveDown: (index: number) => field.moveDown(index),
    disabled: field.disabled,
    readOnly: field.readOnly,
    readPretty: field.readPretty,
  };

  const decoratorProps = {
    ...field.decoratorProps,
    label: field.title,
    required: field.required,
    errors: field.errors,
    warnings: field.warnings,
    description: field.description,
    validateStatus: field.validateStatus,
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
      {rows.map((rowFields, index) => (
        <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
          <div className="flex-1 space-y-2">{rowFields}</div>
          {!field.readPretty && (
            <button
              type="button"
              className="text-destructive text-xs mt-2"
              onClick={() => field.remove(index)}
              disabled={field.disabled || field.readOnly}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {!field.readPretty && (
        <button
          type="button"
          className="text-primary text-sm"
          onClick={() => field.push()}
          disabled={field.disabled || field.readOnly}
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
  schema: any;
  components: ComponentMap;
  decorators: DecoratorMap;
  form: IForm;
  fullPath: string;
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, components, decorators }) => {
  const [, forceRender] = useState(0);

  useEffect(() => field.subscribe(() => forceRender((v) => v + 1)), [field]);

  if (field.display === "none") return null;
  if (field.display === "hidden") return <div style={{ display: "none" }} />;

  const Component = components[field.component];
  const Decorator = decorators[field.decorator];

  const decoratorProps = {
    ...field.decoratorProps,
    label: field.title,
    required: field.required,
    errors: field.errors,
    warnings: field.warnings,
    description: field.description,
    validateStatus: field.validateStatus,
    pattern: field.pattern,
  };

  // content: render content directly if specified
  if (field.content !== null && field.content !== undefined) {
    const contentNode =
      typeof field.content === "string" ? <span>{field.content}</span> : field.content;

    return (
      <FieldContext.Provider value={field}>
        {Decorator ? <Decorator {...decoratorProps}>{contentNode}</Decorator> : contentNode}
      </FieldContext.Provider>
    );
  }

  if (!Component) {
    return (
      <div className="text-destructive text-sm">{`Unknown component: ${field.component}`}</div>
    );
  }

  // Build component props
  const componentProps: Record<string, any> = {
    ...field.componentProps,
    value: field.value,
    onChange: (val: any) => field.setValue(val),
    disabled: field.disabled,
    readOnly: field.readOnly,
    readPretty: field.readPretty,
    loading: field.loading,
    pattern: field.pattern,
  };

  if (field.dataSource.length > 0) {
    componentProps.dataSource = field.dataSource;
  }

  // readPretty mode: prefer a registered ReadPretty variant, fall back to the
  // base component below.
  if (field.readPretty) {
    const PreviewComponent =
      components[`${field.component}.ReadPretty`] || components[`ReadPretty.${field.component}`];
    if (PreviewComponent) {
      const rendered = <PreviewComponent {...componentProps} />;
      return (
        <FieldContext.Provider value={field}>
          {Decorator ? <Decorator {...decoratorProps}>{rendered}</Decorator> : rendered}
        </FieldContext.Provider>
      );
    }
  }

  const rendered = <Component {...componentProps} />;
  return (
    <FieldContext.Provider value={field}>
      {Decorator ? <Decorator {...decoratorProps}>{rendered}</Decorator> : rendered}
    </FieldContext.Provider>
  );
};

// --- Helpers ---

function getSortedEntries(properties: Record<string, any>): [string, any][] {
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
  properties: Record<string, any>,
  definitions: Record<string, any>,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, fieldSchema]) => [
      key,
      resolveFieldSchema(fieldSchema, definitions),
    ]),
  );
}

function resolveFieldSchema(
  schema: any,
  definitions: Record<string, any>,
  seen: Set<string> = new Set(),
): any {
  if (!schema || typeof schema !== "object") return schema;

  let resolved = schema;
  if (typeof schema.$ref === "string") {
    const refPath = schema.$ref.replace(/^#\/definitions\//, "");
    if (seen.has(refPath)) {
      const { $ref: _ignored, ...localProps } = schema;
      void _ignored;
      resolved = localProps;
    } else {
      const referenced = definitions[refPath];
      if (referenced) {
        const { $ref: _ignored, ...localProps } = schema;
        void _ignored;
        resolved = {
          ...resolveFieldSchema(referenced, definitions, new Set([...seen, refPath])),
          ...localProps,
        };
      }
    }
  }

  if (resolved.properties) {
    resolved = {
      ...resolved,
      properties: resolveProperties(resolved.properties, definitions),
    };
  }

  if (resolved.items) {
    resolved = {
      ...resolved,
      items: Array.isArray(resolved.items)
        ? resolved.items.map((item: any) => resolveFieldSchema(item, definitions, seen))
        : resolveFieldSchema(resolved.items, definitions, seen),
    };
  }

  return resolved;
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

// Re-export contexts for custom components
export { FieldContext, FormContext };

// Suppress unused import warning when toolchain inlines Fragment elsewhere
void Fragment;
