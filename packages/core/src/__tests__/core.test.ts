import { describe, expect, it, vi } from 'vitest'
import { createForm } from '../index'
import type { IFormSchema } from '../types'

const basicSchema: IFormSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', title: 'Name', minLength: 2 },
    age: { type: 'number', minimum: 18 },
  },
}

async function waitFor(predicate: () => boolean, timeout = 1000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeout) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('@formily-bao/core', () => {
  it('creates fields from schema and returns form values', () => {
    const form = createForm({ initialValues: { name: 'Bao', age: 20 } })
    form.setSchema(basicSchema)

    expect(form.getField('name')?.value).toBe('Bao')
    expect(form.values).toEqual({ name: 'Bao', age: 20 })
  })

  it('validates JSON Schema keywords together with required fields', async () => {
    const form = createForm({ initialValues: { name: 'A', age: 16 } })
    form.setSchema(basicSchema)

    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors.map((error) => error.type)).toEqual(expect.arrayContaining(['minLength', 'min']))

    form.setValues({ name: 'Bao', age: 20 })
    await expect(form.validate()).resolves.toBe(true)
  })

  it('uses dynamic array values for validation and submission', async () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        users: {
          type: 'array',
          title: 'Users',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', required: true },
            },
          },
        },
      },
    })

    const users = form.getArrayField('users')
    expect(users).toBeTruthy()
    await expect(form.validate()).resolves.toBe(false)

    users?.push({ name: 'Bao' })
    await expect(form.validate()).resolves.toBe(true)
    expect(form.values).toEqual({ users: [{ name: 'Bao' }] })

    users?.remove(0)
    await expect(form.validate()).resolves.toBe(false)
  })

  it('notifies field, values and validation lifecycle changes', async () => {
    const events: string[] = []
    const form = createForm({
      effects: (instance) => {
        instance.onFieldChange('name', () => events.push('field-change'))
        instance.onValuesChange(() => events.push('values-change'))
        ;(instance as any).registerLifecycle('onFieldValueChange', 'name', () => events.push('value-lifecycle'))
        ;(instance as any).registerLifecycle('onFieldValidateStart', 'name', () => events.push('validate-start'))
        ;(instance as any).registerLifecycle('onFieldValidateSuccess', 'name', () => events.push('validate-success'))
        ;(instance as any).registerLifecycle('onFieldValidateEnd', 'name', () => events.push('validate-end'))
      },
    })
    form.setSchema(basicSchema)

    form.getField('name')?.setValue('Bao')
    await form.validate()

    expect(events).toEqual(expect.arrayContaining([
      'field-change',
      'values-change',
      'value-lifecycle',
      'validate-start',
      'validate-success',
      'validate-end',
    ]))
  })

  it('replaces fields when setSchema is called again', () => {
    const form = createForm({ initialValues: { oldField: 'old', newField: 'new' } })
    form.setSchema({
      type: 'object',
      properties: { oldField: { type: 'string' } },
    })
    expect(form.values).toEqual({ oldField: 'old' })

    form.setSchema({
      type: 'object',
      properties: { newField: { type: 'string' } },
    })
    expect(form.getField('oldField')).toBeUndefined()
    expect(form.values).toEqual({ newField: 'new' })
  })

  it('initializes FormBao protocol fields and sorts by order', () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        second: {
          type: 'string',
          title: 'Second',
          order: 2,
          component: 'Select',
          props: { placeholder: 'pick one' },
          decorator: 'FormItem',
          decoratorProps: { tooltip: 'help' },
          dataSource: [{ label: 'A', value: 'a' }],
          data: { tracking: 'second' },
          state: { display: 'hidden', pattern: 'disabled' },
        },
        first: {
          type: 'string',
          title: 'First',
          order: 1,
          state: { readPretty: true },
        },
      },
    })

    expect(Array.from(form.fields.keys())).toEqual(['first', 'second'])
    const second = form.getField('second')
    expect(second?.component).toBe('Select')
    expect(second?.componentProps).toEqual({ placeholder: 'pick one' })
    expect(second?.decoratorProps).toEqual({ tooltip: 'help' })
    expect(second?.dataSource).toEqual([{ label: 'A', value: 'a' }])
    expect(second?.data).toEqual({ tracking: 'second' })
    expect(second?.display).toBe('hidden')
    expect(second?.disabled).toBe(true)
    expect(form.getField('first')?.readPretty).toBe(true)
  })

  it('derives field attributes through property-level expression reactions', () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        type: { type: 'string', default: 'person' },
        name: {
          type: 'string',
          title: 'Name',
          'x-reaction': {
            visible: {
              dependencies: { type: 'type' },
              type: 'expression',
              expression: "$deps.type === 'company'",
            },
            title: {
              dependencies: { type: 'type' },
              type: 'expression',
              expression: "$deps.type === 'company' ? 'Company Name' : 'Person Name'",
            },
            props: {
              dependencies: { type: 'type' },
              type: 'match',
              source: '$deps.type',
              match: {
                company: { placeholder: 'Company' },
                default: { placeholder: 'Person' },
              },
            },
            dataSource: {
              dependencies: { type: 'type' },
              type: 'match',
              source: '$deps.type',
              match: {
                company: [{ label: 'Company', value: 'company' }],
                default: [{ label: 'Person', value: 'person' }],
              },
            },
          },
        },
      },
    })

    const name = form.getField('name')
    expect(name?.visible).toBe(false)
    expect(name?.title).toBe('Person Name')
    expect(name?.componentProps).toEqual({ placeholder: 'Person' })
    expect(name?.dataSource).toEqual([{ label: 'Person', value: 'person' }])

    form.getField('type')?.setValue('company')
    expect(name?.visible).toBe(true)
    expect(name?.title).toBe('Company Name')
    expect(name?.componentProps).toEqual({ placeholder: 'Company' })
    expect(name?.dataSource).toEqual([{ label: 'Company', value: 'company' }])
  })

  it('loads dataSource through computed reaction handlers', async () => {
    const loadCities = vi.fn(async ({ deps }) => {
      if (deps.country === 'cn') return [{ label: 'Beijing', value: 'beijing' }]
      return []
    })
    const form = createForm({ handlers: { loadCities } })
    form.setSchema({
      type: 'object',
      properties: {
        country: { type: 'string' },
        city: {
          type: 'string',
          'x-reaction': {
            dataSource: {
              dependencies: { country: 'country' },
              type: 'computed',
              handler: 'loadCities',
            },
          },
        },
      },
    })

    const city = form.getField('city')
    expect(city?.dataSource).toEqual([])

    form.getField('country')?.setValue('cn')
    await waitFor(() => (city?.dataSource.length || 0) > 0)
    expect(loadCities).toHaveBeenCalledWith(expect.objectContaining({ deps: { country: 'cn' } }))
    expect(city?.dataSource).toEqual([{ label: 'Beijing', value: 'beijing' }])
  })

  it('supports static, expression, match and computed reaction types only', async () => {
    const form = createForm({
      handlers: {
        buildOptions: async ({ deps }) => [{ label: String(deps.kind), value: deps.kind }],
      },
    })
    form.setSchema({
      type: 'object',
      properties: {
        kind: { type: 'string', default: 'a' },
        field: {
          type: 'string',
          'x-reaction': {
            title: { type: 'static', value: 'Static Title' },
            display: {
              dependencies: { kind: 'kind' },
              type: 'expression',
              expression: "$deps.kind === 'hidden' ? 'none' : 'visible'",
            },
            props: {
              dependencies: { kind: 'kind' },
              type: 'match',
              source: '$deps.kind',
              match: {
                a: { placeholder: 'A' },
                default: { placeholder: 'Other' },
              },
            },
            dataSource: {
              dependencies: { kind: 'kind' },
              type: 'computed',
              handler: 'buildOptions',
            },
          },
        },
      },
    })

    const field = form.getField('field')
    await waitFor(() => (field?.dataSource.length || 0) > 0)
    expect(field?.title).toBe('Static Title')
    expect(field?.display).toBe('visible')
    expect(field?.componentProps).toEqual({ placeholder: 'A' })
    expect(field?.dataSource).toEqual([{ label: 'a', value: 'a' }])

    form.getField('kind')?.setValue('hidden')
    expect(field?.display).toBe('none')
    expect(field?.componentProps).toEqual({ placeholder: 'Other' })
  })

  it('rejects unsafe expressions without run escape hatches', () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        source: { type: 'string', default: 'x' },
        unsafeField: {
          type: 'string',
          'x-reaction': {
            value: {
              dependencies: { source: 'source' },
              type: 'expression',
              expression: 'globalThis.process',
            },
          },
        },
      },
    })

    expect(form.getField('unsafeField')?.value).toBeUndefined()
  })

  it('keeps field-owned reactions independent across dependencies', () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        source: { type: 'string', default: 'off' },
        first: {
          type: 'string',
          state: { visible: false },
          'x-reaction': {
            visible: {
              dependencies: { source: 'source' },
              type: 'expression',
              expression: "$deps.source === 'on'",
            },
          },
        },
        second: {
          type: 'string',
          state: { visible: false },
          'x-reaction': {
            visible: {
              dependencies: { source: 'source' },
              type: 'expression',
              expression: "$deps.source === 'on'",
            },
          },
        },
      },
    })

    expect(form.getField('first')?.visible).toBe(false)
    expect(form.getField('second')?.visible).toBe(false)

    form.getField('source')?.setValue('on')
    expect(form.getField('first')?.visible).toBe(true)
    expect(form.getField('second')?.visible).toBe(true)
  })

  it('initializes all state shortcuts and excludes display none fields from values and validation', async () => {
    const form = createForm({
      initialValues: {
        hiddenByVisible: '',
        hiddenByDisplay: '',
        hiddenField: 'kept-in-runtime',
        disabledField: 'disabled',
        readOnlyField: 'readonly',
        readPrettyField: 'pretty',
        nonEditableField: 'locked',
      },
    })

    form.setSchema({
      type: 'object',
      properties: {
        hiddenByVisible: {
          type: 'string',
          title: 'Hidden by visible',
          required: true,
          state: { visible: false },
        },
        hiddenByDisplay: {
          type: 'string',
          title: 'Hidden by display',
          required: true,
          state: { display: 'none' },
        },
        hiddenField: {
          type: 'string',
          state: { hidden: true },
        },
        disabledField: {
          type: 'string',
          state: { disabled: true },
        },
        readOnlyField: {
          type: 'string',
          state: { readOnly: true },
        },
        readPrettyField: {
          type: 'string',
          state: { readPretty: true },
        },
        nonEditableField: {
          type: 'string',
          state: { editable: false },
        },
      },
    })

    expect(form.getField('hiddenByVisible')?.display).toBe('none')
    expect(form.getField('hiddenByDisplay')?.visible).toBe(false)
    expect(form.getField('hiddenField')?.display).toBe('hidden')
    expect(form.getField('hiddenField')?.hidden).toBe(true)
    expect(form.getField('disabledField')?.disabled).toBe(true)
    expect(form.getField('readOnlyField')?.readOnly).toBe(true)
    expect(form.getField('readPrettyField')?.readPretty).toBe(true)
    expect(form.getField('nonEditableField')?.readOnly).toBe(true)

    expect(form.values).not.toHaveProperty('hiddenByVisible')
    expect(form.values).not.toHaveProperty('hiddenByDisplay')
    expect(form.values).toHaveProperty('hiddenField', 'kept-in-runtime')
    await expect(form.validate()).resolves.toBe(true)
  })

  it('updates decorator, component and props through property reactions', () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        mode: { type: 'string', default: 'readonly' },
        derivedField: {
          type: 'string',
          component: 'Input',
          props: { placeholder: 'initial' },
          decorator: 'FormItem',
          'x-reaction': {
            component: {
              dependencies: { mode: 'mode' },
              type: 'match',
              source: '$deps.mode',
              match: { readonly: 'Textarea', default: 'Input' },
            },
            props: {
              dependencies: { mode: 'mode' },
              type: 'match',
              source: '$deps.mode',
              match: {
                readonly: { rows: 4, placeholder: 'readonly mode' },
                default: { placeholder: 'editable mode' },
              },
            },
            decoratorProps: {
              type: 'static',
              value: { tooltip: 'dynamic help' },
            },
            pattern: {
              dependencies: { mode: 'mode' },
              type: 'match',
              source: '$deps.mode',
              match: { readonly: 'readOnly', default: 'editable' },
            },
          },
        },
      },
    })

    const derivedField = form.getField('derivedField')
    expect(derivedField?.component).toBe('Textarea')
    expect(derivedField?.componentProps).toEqual({ placeholder: 'readonly mode', rows: 4 })
    expect(derivedField?.decoratorProps).toEqual({ tooltip: 'dynamic help' })
    expect(derivedField?.readOnly).toBe(true)

    form.getField('mode')?.setValue('editable')
    expect(derivedField?.component).toBe('Input')
    expect(derivedField?.componentProps).toEqual({ placeholder: 'editable mode', rows: 4 })
    expect(derivedField?.editable).toBe(true)
  })

  it('formats input and output values with x-format', async () => {
    const form = createForm({ initialValues: { amount: 1234 } })
    form.setSchema({
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          'x-format': {
            input: {
              type: 'expression',
              expression: '$value / 100',
            },
            output: {
              type: 'expression',
              expression: '$value * 100',
            },
          },
        },
      },
    })

    expect(form.getField('amount')?.value).toBe(12.34)
    expect(form.values).toEqual({ amount: 1234 })

    form.setValues({ amount: 2500 })
    expect(form.getField('amount')?.value).toBe(25)
    await expect(form.submit()).resolves.toEqual({ amount: 2500 })
  })

  it('uses current value as default match source for x-format', async () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        status: {
          type: 'string',
          default: 1,
          'x-format': {
            input: { type: 'match', match: { '1': 'enabled', '0': 'disabled', default: 'disabled' } },
            output: { type: 'match', match: { enabled: 1, disabled: 0, default: 0 } },
          },
        },
      },
    })

    expect(form.getField('status')?.value).toBe('enabled')
    await expect(form.submit()).resolves.toEqual({ status: 1 })

    form.getField('status')?.setValue('disabled')
    await expect(form.submit()).resolves.toEqual({ status: 0 })
  })

  it('formats schema default values with x-format input', async () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          default: 12345,
          'x-format': {
            input: {
              type: 'expression',
              expression: '$value / 100',
            },
            output: {
              type: 'expression',
              expression: '$value * 100',
            },
          },
        },
      },
    })

    expect(form.getField('amount')?.value).toBe(123.45)
    expect(form.values).toEqual({ amount: 12345 })
    await expect(form.submit()).resolves.toEqual({ amount: 12345 })
  })

  it('treats undefined x-validate expression result as passed', async () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        username: {
          type: 'string',
          default: 'admin',
          'x-validate': {
            type: 'expression',
            expression: "$value === 'admin' ? undefined : 'Username must be admin'",
          },
        },
      },
    })

    await expect(form.validate()).resolves.toBe(true)
    expect(form.errors).toEqual([])

    form.getField('username')?.setValue('guest')
    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors).toEqual([{ message: 'Username must be admin', type: 'x-validate' }])
  })

  it('reconciles value when dataSource changes by dataSourcePolicy', () => {
    const form = createForm({ initialValues: { city: 'beijing', tags: ['a', 'x'] } })
    form.setSchema({
      type: 'object',
      properties: {
        country: {
          type: 'string',
          default: 'cn',
        },
        city: {
          type: 'string',
          dataSourcePolicy: { value: 'clear' },
          dataSource: [{ label: '北京', value: 'beijing' }],
          'x-reaction': {
            dataSource: {
              type: 'match',
              dependencies: { country: 'country' },
              match: {
                cn: [{ label: '北京', value: 'beijing' }],
                sg: [{ label: '新加坡', value: 'singapore' }],
              },
            },
          },
        },
        tags: {
          type: 'array',
          dataSourcePolicy: { value: 'filter' },
          dataSource: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      },
    })

    expect(form.getField('city')?.value).toBe('beijing')
    form.getField('country')?.setValue('sg')
    expect(form.getField('city')?.value).toBeUndefined()

    form.getField('tags')?.setDataSource([{ label: 'A', value: 'a' }])
    expect(form.getField('tags')?.value).toEqual(['a'])
  })

  it('supports x-validate dependencies for cross-field validation', async () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        password: {
          type: 'string',
          default: '123456',
        },
        confirmPassword: {
          type: 'string',
          default: '123456',
          'x-validate': {
            type: 'expression',
            dependencies: { password: 'password' },
            expression: '$value === $deps.password ? undefined : "Passwords do not match"',
          },
        },
      },
    })

    await expect(form.validate()).resolves.toBe(true)
    expect(form.errors).toEqual([])

    form.getField('confirmPassword')?.setValue('654321')
    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors).toEqual([{ message: 'Passwords do not match', type: 'x-validate' }])
  })

  it('supports computed x-format handlers and x-validate rules', async () => {
    const normalizeCode = vi.fn(({ value }) => String(value || '').trim().toUpperCase())
    const checkCode = vi.fn(async ({ value }) => {
      if (value === 'OK') return []
      return [{ message: 'Code must be OK', type: 'x-validate' }]
    })
    const form = createForm({
      initialValues: { code: ' ok ' },
      handlers: { normalizeCode, checkCode },
    })
    form.setSchema({
      type: 'object',
      properties: {
        code: {
          type: 'string',
          'x-format': {
            input: { type: 'computed', handler: 'normalizeCode' },
            output: { type: 'computed', handler: 'normalizeCode' },
          },
          'x-validate': {
            type: 'computed',
            handler: 'checkCode',
          },
        },
      },
    })

    expect(form.getField('code')?.value).toBe('OK')
    await expect(form.validate()).resolves.toBe(true)
    expect(checkCode).toHaveBeenCalledWith(expect.objectContaining({ value: 'OK', kind: 'x-validate' }))

    form.getField('code')?.setValue('bad')
    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors).toEqual([{ message: 'Code must be OK', type: 'x-validate' }])
  })

})
