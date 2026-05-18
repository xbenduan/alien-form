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

  it('uses async data source fetch options', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [{ label: 'Remote', value: 'remote' }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        choice: {
          type: 'string',
          asyncDataSource: {
            url: '/api/options',
            method: 'POST',
            headers: { 'X-Test': 'yes' },
            data: { scope: 'core' },
          },
        },
      },
    })

    const field = form.getField('choice')
    await waitFor(() => (field?.dataSource.length || 0) > 0)

    expect(fetchMock).toHaveBeenCalledWith('/api/options', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json', 'X-Test': 'yes' }),
      body: JSON.stringify({ scope: 'core' }),
    }))
    expect(field?.dataSource).toEqual([{ label: 'Remote', value: 'remote' }])

    vi.unstubAllGlobals()
  })
})
