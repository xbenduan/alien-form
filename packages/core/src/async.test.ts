import { describe, expect, it, vi } from 'vitest';
import { createForm } from './form';
import type { FormError, IFormSchema, PrimitiveFieldNode } from './types';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function primitive(form: ReturnType<typeof createForm>, path: string): PrimitiveFieldNode {
  const f = form.field(path);
  if (!f || f.kind !== 'primitive') throw new Error(`primitive "${path}" missing`);
  return f;
}

describe('async — reactions', () => {
  it('applies an async reaction value after the promise resolves', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { value: '@loadName' } } },
    };
    const form = createForm({
      schema,
      handlers: { loadName: async () => { await tick(); return 'async-name'; } },
    });
    form.mount();
    expect(form.get('name')).toBeUndefined();
    await tick();
    await tick();
    expect(form.get('name')).toBe('async-name');
  });

  it('reports an async reaction rejection via onError', async () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { value: '@failLoad' } } },
    };
    const form = createForm({
      schema,
      onError: (e) => errors.push(e),
      handlers: { failLoad: async () => { await tick(); throw new Error('async-fail'); } },
    });
    form.mount();
    await tick();
    await tick();
    expect(errors.some((e) => e.scope === 'x-reaction' && e.message.includes('async-fail'))).toBe(true);
  });

  it('does not apply a stale async reaction result after the form is destroyed', async () => {
    let resolveFn: (v: string) => void = () => {};
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { value: '@slow' } } },
    };
    const form = createForm({
      schema,
      handlers: { slow: () => new Promise<string>((res) => { resolveFn = res; }) },
    });
    form.mount();
    // capture the field before teardown so we can read its raw signal afterwards
    const field = primitive(form, 'name');
    form.destroy();
    // resolve AFTER destroy: the cancellation flag must suppress the write
    resolveFn('too-late');
    await tick();
    await tick();
    expect(field.value()).toBeUndefined();
  });
});

describe('async — x-validate', () => {
  it('awaits an async validator and surfaces its error message', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          'x-validate': '@checkUnique',
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { username: 'taken' },
      handlers: {
        checkUnique: async (rt) => {
          await tick();
          return rt.value === 'taken' ? '用户名已被占用' : true;
        },
      },
    });
    const ok = await form.validate();
    expect(ok).toBe(false);
    expect(form.errors().some((e) => e.message === '用户名已被占用')).toBe(true);
  });

  it('passes async validation when the validator resolves true', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { username: { type: 'string', 'x-validate': '@checkUnique' } },
    };
    const form = createForm({
      schema,
      initialValues: { username: 'free' },
      handlers: { checkUnique: async () => { await tick(); return true; } },
    });
    expect(await form.validate()).toBe(true);
  });

  it('rejects submit when async validation fails and exposes messages', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { email: { type: 'string', required: true, 'x-validate': '@checkEmail' } },
    };
    const form = createForm({
      schema,
      initialValues: { email: 'bad' },
      handlers: { checkEmail: async () => { await tick(); return '邮箱格式错误'; } },
    });
    await expect(form.submit()).rejects.toMatchObject({ message: 'Validation failed' });
    try {
      await form.submit();
    } catch (err: any) {
      expect(err.messages).toContain('邮箱格式错误');
    }
  });

  it('resets submitting back to false after an async submit failure', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { email: { type: 'string', 'x-validate': '@checkEmail' } },
    };
    const form = createForm({
      schema,
      initialValues: { email: 'bad' },
      handlers: { checkEmail: async () => { await tick(); return 'no good'; } },
    });
    await form.submit().catch(() => {});
    expect(form.submitting()).toBe(false);
  });
});

describe('async — x-effect', () => {
  it('registers an async-returned disposer and calls it on destroy', async () => {
    const dispose = vi.fn();
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-effect': '@startEffect' } },
    };
    const form = createForm({
      schema,
      handlers: { startEffect: async () => { await tick(); return dispose; } },
    });
    form.mount();
    await tick();
    await tick();
    form.destroy();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('calls a synchronously-returned effect disposer on destroy', () => {
    const dispose = vi.fn();
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-effect': '@startEffect' } },
    };
    const form = createForm({ schema, handlers: { startEffect: () => dispose } });
    form.mount();
    form.destroy();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('reports an async x-effect rejection via onError', async () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-effect': '@badEffect' } },
    };
    const form = createForm({
      schema,
      onError: (e) => errors.push(e),
      handlers: { badEffect: async () => { await tick(); throw new Error('effect-fail'); } },
    });
    form.mount();
    await tick();
    await tick();
    expect(errors.some((e) => e.scope === 'x-effect' && e.message.includes('effect-fail'))).toBe(true);
  });
});

describe('async — x-format must be synchronous', () => {
  it('emits an error and keeps the original value when x-format.input returns a promise', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          'x-format': { input: '@asyncFmt' },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { name: 'raw' },
      onError: (e) => errors.push(e),
      handlers: { asyncFmt: async () => 'formatted' },
    });
    // input formatting runs at construction time; the async result is rejected
    expect(form.get('name')).toBe('raw');
    expect(errors.some((e) => e.scope === 'x-format' && e.message.includes('must be synchronous'))).toBe(true);
  });

  it('emits an error when x-format.output returns a promise and falls back to the raw value', async () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', 'x-format': { output: '@asyncOut' } },
      },
    };
    const form = createForm({
      schema,
      initialValues: { name: 'value' },
      onError: (e) => errors.push(e),
      handlers: { asyncOut: async () => 'wrapped' },
    });
    await expect(form.submit()).resolves.toEqual({ name: 'value' });
    expect(errors.some((e) => e.scope === 'x-format' && e.key === 'output')).toBe(true);
  });
});

describe('async — submit happy path', () => {
  it('returns the submitted values through an async onSubmit', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string' } },
    };
    const form = createForm({ schema, initialValues: { a: 'hi' } });
    const result = await form.submit(async (values) => { await tick(); return { saved: values }; });
    expect(result).toEqual({ saved: { a: 'hi' } });
    expect(form.submitting()).toBe(false);
  });
});
