# @alien-form/core

Headless form runtime for AlienForm.

## What It Does

- Builds a field tree from a single schema
- Runs `x-reaction`, `x-effect`, `x-format`, and `x-validate`
- Projects visible values for `form.values()`, `form.project()`, and `form.submit()`
- Supports arrays, objects, void layout nodes, `$ref`, and data-source policies
- Uses a restricted expression runtime instead of `eval` / `new Function`

## Runtime Value Model

AlienForm now uses one small runtime model everywhere.

A runtime value can be:

- a literal value: `"text"`, `100`, `true`, `{}` , `[]`
- an expression string: `"{{ a ? b : c }}"`
- a handler string: `"@loadOptions"`
- a direct function: `(ctx, form) => any`
- an array of runtime values

## Schema Rules

### `required`

- Keeps field-level required UI state
- Also provides the built-in required validation message: `该字段为必填项`

### `x-reaction`

Use it to derive field properties such as:

- `value`
- `display`
- `disabled`
- `required`
- `title`
- `description`
- `props`
- `decoratorProps`
- `component`
- `decorator`
- `dataSource`

### `x-format`

- `input`: runs only during initial value loading
- `output`: runs when reading output values via `form.values()`, `form.project()`, or `form.submit()`
- must stay synchronous

### `x-validate`

Return semantics:

- `undefined` / `null` / `true`: pass
- `false`: fail with default message
- `string`: fail with custom message
- `{ message: string }`: fail with structured error

## Expression Scope

Expressions can read:

- `$self`
- `$form`
- `$values`
- `$value`
- `$row`
- `$path`
- `$get(selector)`
- `$project(selector?)`
- custom `FormConfig.scope`

The expression runtime supports literals, member access, arithmetic, comparison, logical operators, ternary, arrays, and objects.

It rejects:

- function calls
- assignments
- template literals
- `eval`, `Function`, `window`, `document`, `process`, `constructor`, `prototype`, `__proto__`

## Data Source Policy

For fields with `dataSource`, `dataSourcePolicy` controls what happens when options change:

- `preserve`: keep current value
- `clear`: clear invalid value
- `filter`: remove invalid values from arrays, clear invalid scalar values
- `first`: fall back to the first option when current value becomes invalid

## Minimal Example

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  schema: {
    type: "object",
    properties: {
      role: {
        type: "string",
        component: "Select",
        dataSource: [
          { label: "Admin", value: "admin" },
          { label: "User", value: "user" },
        ],
      },
      permissions: {
        type: "string",
        component: "Select",
        dataSourcePolicy: "first",
        "x-reaction": {
          dataSource: "{{ role === 'admin' ? [{ label: 'All', value: '*' }] : [{ label: 'Read', value: 'read' }] }}",
          display: "{{ role ? 'visible' : 'none' }}",
        },
      },
      tags: {
        type: "tags",
        "x-format": {
          input: ({ value }) => Array.isArray(value) ? value.filter(Boolean) : [],
          output: ({ value }) => Array.isArray(value) ? value.join(",") : value,
        },
        "x-validate": "{{ $value && $value.length > 0 ? true : '至少选择一个标签' }}",
      },
    },
  },
  initialValues: {
    role: "user",
    tags: ["a", "", "b"],
  },
  handlers: {
    loadOptions({ value }) {
      return value;
    },
  },
});

form.mount();
const ok = await form.validate();
const values = await form.submit();
form.unmount();
```

## Public API

```ts
interface FormConfig {
  schema?: IFormSchema;
  initialValues?: Record<string, any>;
  scope?: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  onError?: (error: FormError) => void;
}

interface FormInstance {
  schema: IFormSchema;
  root: ObjectFieldNode;
  fields: Signal<Map<string, FieldNode>>;
  submitting: Signal<boolean>;
  values: Computed<Record<string, any>>;
  errors: Computed<FieldError[]>;
  valid: Computed<boolean>;
  field(path: string): FieldNode | undefined;
  get(selector: string): any;
  set(selector: string, value: any): void;
  project(selector?: string): any;
  setValues(values: Record<string, any>): void;
  setInitialValues(values: Record<string, any>): void;
  reset(): void;
  mount(): void;
  unmount(): void;
  validate(): Promise<boolean>;
  submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>;
  destroy(): void;
  onError(listener: (error: FormError) => void): () => void;
  effect(runner: (form: FormInstance) => void | (() => void)): () => void;
}
```

## Development

```bash
pnpm test:core
pnpm build:core
```
