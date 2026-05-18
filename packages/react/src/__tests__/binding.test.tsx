import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { createForm } from '@formily-bao/core'
import { FormProvider, SchemaField, useForm, useFormState } from '../index'

afterEach(() => {
  cleanup()
})

function Input(props: any) {
  const { value, onChange, ...rest } = props
  return (
    <input
      {...rest}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}

const components = { Input }

describe('react bindings', () => {
  it('renders and propagates setValue', () => {
    const form = createForm()
    const schema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const, component: 'Input', props: { 'data-testid': 'name' } },
      },
    }
    form.setSchema(schema)
    const { getByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
      </FormProvider>,
    )
    const input = getByTestId('name') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hi' } })
    expect(form.values.name).toBe('hi')
  })

  it('reacts to visibility changes', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        age: { type: 'number' as const, component: 'Input', props: { 'data-testid': 'age' } },
        adult: {
          type: 'string' as const,
          component: 'Input',
          props: { 'data-testid': 'adult' },
          'x-reaction': {
            visible: { type: 'expression' as const, dependencies: { age: 'age' }, expression: '$deps.age >= 18' },
          },
        },
      },
    }
    const form = createForm({ initialValues: { age: 10 } })
    const { queryByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
      </FormProvider>,
    )
    expect(queryByTestId('adult')).toBeNull()
    act(() => {
      form.setValues({ age: 20 })
    })
    expect(queryByTestId('adult')).not.toBeNull()
  })

  it('useFormState triggers rerender', () => {
    const form = createForm()
    const schema = {
      type: 'object' as const,
      properties: { name: { type: 'string' as const, component: 'Input', props: { 'data-testid': 'name' } } },
    }
    function StateView() {
      const state = useFormState()
      const f = useForm()
      return (
        <div>
          <span data-testid="name-val">{String(state.values.name ?? '')}</span>
          <button data-testid="set" onClick={() => f.setValues({ name: 'x' })} />
        </div>
      )
    }
    const { getByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
        <StateView />
      </FormProvider>,
    )
    expect(getByTestId('name-val').textContent).toBe('')
    act(() => {
      fireEvent.click(getByTestId('set'))
    })
    expect(getByTestId('name-val').textContent).toBe('x')
  })

  it('array field push/remove preserves Field identity', () => {
    const form = createForm()
    form.setSchema({
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    })
    const arr = form.getField('users')!
    expect(arr).toBeTruthy()
    arr.push({ name: 'a' })
    arr.push({ name: 'b' })
    arr.push({ name: 'c' })
    const row1Before = form.getField('users.1.name')!
    const row2Before = form.getField('users.2.name')!
    expect(row1Before).toBeTruthy()
    expect(row2Before).toBeTruthy()
    arr.remove(0)
    const row0After = form.getField('users.0.name')!
    const row1After = form.getField('users.1.name')!
    expect(row0After).toBe(row1Before)
    expect(row1After).toBe(row2Before)
    expect(form.values.users).toEqual([{ name: 'b' }, { name: 'c' }])
  })

  it('schema replacement updates tree', () => {
    const form = createForm()
    form.setSchema({ type: 'object', properties: { a: { type: 'string', component: 'Input' } } })
    expect(form.getField('a')).toBeTruthy()
    form.setSchema({ type: 'object', properties: { b: { type: 'string', component: 'Input' } } })
    expect(form.getField('a')).toBeUndefined()
    expect(form.getField('b')).toBeTruthy()
  })
})
