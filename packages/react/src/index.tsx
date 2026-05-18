/**
 * @formily-bao/react — React bindings
 * Enterprise schema protocol inspired by Formily
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
} from 'react'
import type { IForm, IField, IFormSchema } from '@formily-bao/core'


export type ComponentMap = Record<string, React.ComponentType<any>>
export type DecoratorMap = Record<string, React.ComponentType<any>>

// --- Contexts ---

interface FormContextValue {
  form: IForm
  components: ComponentMap
  decorators: DecoratorMap
}

const FormContext = createContext<FormContextValue | null>(null)
const FieldContext = createContext<IField | null>(null)

// --- Hooks ---

export function useForm(): IForm {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('useForm must be used within FormProvider')
  return ctx.form
}

export function useField(path?: string): IField | null {
  const ctx = useContext(FormContext)
  const parentField = useContext(FieldContext)
  if (!ctx) return null

  const resolvedPath = path || parentField?.path
  if (!resolvedPath) return null

  const field = ctx.form.getField(resolvedPath) || null

  // Subscribe to field changes
  const [, forceRender] = useState(0)
  useEffect(() => {
    if (!field) return
    return field.subscribe(() => forceRender((v) => v + 1))
  }, [field])

  return field
}

export function useFormState() {
  const form = useForm()
  const [, forceRender] = useState(0)

  useEffect(() => {
    return form.subscribe(() => forceRender((v) => v + 1))
  }, [form])

  return {
    values: form.values,
    valid: form.valid,
    invalid: form.invalid,
    submitting: form.submitting,
    errors: form.errors,
  }
}

export function useArrayField(path: string) {
  const form = useForm()
  const field = useField(path)

  return {
    field,
    items: field?.arrayItems || [],
    push: (initialValues?: Record<string, any>) => field?.push(initialValues),
    remove: (index: number) => field?.remove(index),
    moveUp: (index: number) => field?.moveUp(index),
    moveDown: (index: number) => field?.moveDown(index),
  }
}

// --- FormProvider ---

interface FormProviderProps {
  form: IForm
  components?: ComponentMap
  decorators?: DecoratorMap
  children?: React.ReactNode
}

export const FormProvider: React.FC<FormProviderProps> = ({
  form,
  components = {},
  decorators = {},
  children,
}) => {
  const value = useMemo(
    () => ({ form, components, decorators }),
    [form, components, decorators]
  )
  return React.createElement(FormContext.Provider, { value }, children)
}

// --- SchemaField: renders a form from schema ---

interface SchemaFieldProps {
  schema: IFormSchema
}

export const SchemaField: React.FC<SchemaFieldProps> = ({ schema }) => {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('SchemaField must be used within FormProvider')

  const { form, components, decorators } = ctx

  // Initialize or replace fields when schema/form changes.
  // The first render happens before useEffect runs, so force a render after
  // setSchema creates fields; otherwise default components stay empty until
  // another UI interaction triggers a parent render.
  const [, forceRender] = useState(0)
  useEffect(() => {
    form.setSchema(schema)
    forceRender((v) => v + 1)
  }, [form, schema])

  if (!schema.properties) return null

  // Sort by order
  const sortedEntries = getSortedEntries(schema.properties)

  return React.createElement(
    React.Fragment,
    null,
    ...sortedEntries.map(([key, fieldSchema]) => {
      return React.createElement(SchemaFieldItem, {
        key,
        path: key,
        schema: fieldSchema,
        components,
        decorators,
        form,
        parentPath: '',
      })
    })
  )
}

interface SchemaFieldItemProps {
  path: string
  schema: any
  components: ComponentMap
  decorators: DecoratorMap
  form: IForm
  parentPath: string
}

const SchemaFieldItem: React.FC<SchemaFieldItemProps> = ({
  path,
  schema,
  components,
  decorators,
  form,
  parentPath,
}) => {
  const fullPath = parentPath ? `${parentPath}.${path}` : path
  const field = form.getField(fullPath)

  // Void nodes — layout containers
  if (schema.type === 'void' && schema.properties) {
    const LayoutComponent = schema.component ? components[schema.component] : null
    const layoutProps = {
      ...(schema.props || {}),
      ...(schema.layoutProps || {}),
      title: schema.title,
      description: schema.description,
    }

    // Sort children by order
    const sortedChildren = getSortedEntries(schema.properties)

    const children = sortedChildren.map(([key, childSchema]) =>
      React.createElement(SchemaFieldItem, {
        key,
        path: key,
        schema: childSchema,
        components,
        decorators,
        form,
        parentPath: fullPath,
      })
    )

    if (LayoutComponent) {
      return React.createElement(LayoutComponent, layoutProps, ...children)
    }
    return React.createElement(React.Fragment, null, ...children)
  }

  // Object nodes with children but no component
  if (schema.type === 'object' && schema.properties && !schema.component) {
    const sortedChildren = getSortedEntries(schema.properties)
    return React.createElement(
      React.Fragment,
      null,
      ...sortedChildren.map(([key, childSchema]) =>
        React.createElement(SchemaFieldItem, {
          key,
          path: key,
          schema: childSchema,
          components,
          decorators,
          form,
          parentPath: fullPath,
        })
      )
    )
  }

  // Array field
  if (schema.type === 'array' && schema.items?.properties) {
    if (!field) return null
    return React.createElement(ArrayFieldRenderer, {
      field,
      schema,
      components,
      decorators,
      form,
      fullPath,
    })
  }

  if (!field) return null

  return React.createElement(FieldRenderer, {
    field,
    schema,
    components,
    decorators,
    form,
    fullPath,
  })
}

// --- ArrayFieldRenderer ---

interface ArrayFieldRendererProps {
  field: IField
  schema: any
  components: ComponentMap
  decorators: DecoratorMap
  form: IForm
  fullPath: string
}

const ArrayFieldRenderer: React.FC<ArrayFieldRendererProps> = ({
  field,
  schema,
  components,
  decorators,
  form,
  fullPath,
}) => {
  const [, forceRender] = useState(0)

  useEffect(() => {
    return field.subscribe(() => forceRender((v) => v + 1))
  }, [field])

  useEffect(() => {
    return form.subscribe(() => forceRender((v) => v + 1))
  }, [form])

  // Check display
  if (field.display === 'none') return null
  if (field.display === 'hidden') {
    return React.createElement('div', { style: { display: 'none' } })
  }

  const componentName = field.component
  const decoratorName = field.decorator
  const ArrayComponent = components[componentName]
  const Decorator = decorators[decoratorName]

  const arrayValue = Array.isArray(field.value) ? field.value : []
  const itemSchema = schema.items

  // Build rows of rendered child fields
  const rows = arrayValue.map((_: any, index: number) => {
    const rowFields: React.ReactNode[] = []
    if (itemSchema?.properties) {
      const sortedProps = getSortedEntries(itemSchema.properties)
      for (const [childKey, childSchema] of sortedProps) {
        const childPath = `${fullPath}.${index}.${childKey}`
        const childField = form.getField(childPath)
        if (childField) {
          rowFields.push(
            React.createElement(FieldRenderer, {
              key: childKey,
              field: childField,
              schema: childSchema,
              components,
              decorators,
              form,
              fullPath: childPath,
            })
          )
        }
      }
    }
    return rowFields
  })

  // Build array component props
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
  }

  if (ArrayComponent) {
    const rendered = React.createElement(ArrayComponent, arrayProps)
    if (Decorator) {
      const decoratorProps = {
        ...field.decoratorProps,
        label: field.title,
        required: field.required,
        errors: field.errors,
        warnings: field.warnings,
        description: field.description,
        validateStatus: field.validateStatus,
      }
      return React.createElement(
        FieldContext.Provider,
        { value: field },
        React.createElement(Decorator, decoratorProps, rendered)
      )
    }
    return React.createElement(FieldContext.Provider, { value: field }, rendered)
  }

  // Fallback: simple list rendering
  const fallback = React.createElement(
    'div',
    { className: 'space-y-3' },
    ...rows.map((rowFields, index) =>
      React.createElement(
        'div',
        { key: index, className: 'flex items-start gap-2 p-3 border rounded-lg' },
        React.createElement('div', { className: 'flex-1 space-y-2' }, ...rowFields),
        !field.readPretty && React.createElement(
          'button',
          {
            type: 'button',
            className: 'text-destructive text-xs mt-2',
            onClick: () => field.remove(index),
            disabled: field.disabled || field.readOnly,
          },
          'Remove'
        )
      )
    ),
    !field.readPretty && React.createElement(
      'button',
      {
        type: 'button',
        className: 'text-primary text-sm',
        onClick: () => field.push(),
        disabled: field.disabled || field.readOnly,
      },
      '+ Add Item'
    )
  )

  if (Decorator) {
    const decoratorProps = {
      ...field.decoratorProps,
      label: field.title,
      required: field.required,
      errors: field.errors,
      warnings: field.warnings,
      description: field.description,
      validateStatus: field.validateStatus,
    }
    return React.createElement(
      FieldContext.Provider,
      { value: field },
      React.createElement(Decorator, decoratorProps, fallback)
    )
  }

  return React.createElement(FieldContext.Provider, { value: field }, fallback)
}

// --- FieldRenderer ---

interface FieldRendererProps {
  field: IField
  schema: any
  components: ComponentMap
  decorators: DecoratorMap
  form: IForm
  fullPath: string
}

const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  schema,
  components,
  decorators,
  form,
  fullPath,
}) => {
  const [, forceRender] = useState(0)

  useEffect(() => {
    return field.subscribe(() => forceRender((v) => v + 1))
  }, [field])

  // Handle display
  if (field.display === 'none') return null
  if (field.display === 'hidden') {
    return React.createElement('div', { style: { display: 'none' } })
  }

  const componentName = field.component
  const decoratorName = field.decorator

  const Component = components[componentName]
  const Decorator = decorators[decoratorName]

  // content: render content directly if specified
  if (field.content !== null && field.content !== undefined) {
    const contentNode = typeof field.content === 'string'
      ? React.createElement('span', null, field.content)
      : field.content

    if (Decorator) {
      const decoratorProps = {
        ...field.decoratorProps,
        label: field.title,
        required: field.required,
        errors: field.errors,
        warnings: field.warnings,
        description: field.description,
        validateStatus: field.validateStatus,
      }
      return React.createElement(
        FieldContext.Provider,
        { value: field },
        React.createElement(Decorator, decoratorProps, contentNode)
      )
    }
    return React.createElement(FieldContext.Provider, { value: field }, contentNode)
  }

  if (!Component) {
    return React.createElement('div', { className: 'text-destructive text-sm' }, `Unknown component: ${componentName}`)
  }

  // Build component props
  const componentProps: Record<string, any> = {
    ...field.componentProps,
    value: field.value,
    onChange: (val: any) => {
      field.setValue(val)
    },
    disabled: field.disabled,
    readOnly: field.readOnly,
    readPretty: field.readPretty,
    loading: field.loading,
    pattern: field.pattern,
  }

  // Add dataSource for components that support it
  if (field.dataSource.length > 0) {
    componentProps.dataSource = field.dataSource
  }

  // readPretty mode — show value as text if no specific readPretty handling in component
  if (field.readPretty) {
    const PreviewComponent = components[`${componentName}.ReadPretty`] || components[`ReadPretty.${componentName}`]
    if (PreviewComponent) {
      const rendered = React.createElement(PreviewComponent, componentProps)
      if (Decorator) {
        const decoratorProps = {
          ...field.decoratorProps,
          label: field.title,
          required: field.required,
          errors: field.errors,
          warnings: field.warnings,
          description: field.description,
          validateStatus: field.validateStatus,
          pattern: field.pattern,
        }
        return React.createElement(
          FieldContext.Provider,
          { value: field },
          React.createElement(Decorator, decoratorProps, rendered)
        )
      }
      return React.createElement(FieldContext.Provider, { value: field }, rendered)
    }
  }

  const rendered = React.createElement(Component, componentProps)

  // Wrap in decorator
  if (Decorator) {
    const decoratorProps = {
      ...field.decoratorProps,
      label: field.title,
      required: field.required,
      errors: field.errors,
      warnings: field.warnings,
      description: field.description,
      validateStatus: field.validateStatus,
      pattern: field.pattern,
    }
    return React.createElement(
      FieldContext.Provider,
      { value: field },
      React.createElement(Decorator, decoratorProps, rendered)
    )
  }

  return React.createElement(FieldContext.Provider, { value: field }, rendered)
}

// --- Helpers ---

function getSortedEntries(properties: Record<string, any>): [string, any][] {
  return Object.entries(properties).sort(([, a], [, b]) => {
    const ai = a?.order ?? Infinity
    const bi = b?.order ?? Infinity
    return ai - bi
  })
}

// Re-export FieldContext for custom components
export { FieldContext, FormContext }
