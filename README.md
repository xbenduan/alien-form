<p align="center">
  <img src="https://img.shields.io/badge/alien--signals-powered-7C3AED?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjQiLz48cGF0aCBkPSJNMTIgMnYyTTEyIDIwdjJNMiAxMmgyTTIwIDEyaDJNNC45MyA0LjkzbDEuNDEgMS40MU0xNy42NiAxNy42NmwxLjQxIDEuNDFNNC45MyAxOS4wN2wxLjQxLTEuNDFNMTcuNjYgNi4zNGwxLjQxLTEuNDEiLz48L3N2Zz4=&logoColor=white" alt="alien-signals powered">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/zero_dependencies-18181B?style=for-the-badge" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/~3KB_gzipped-059669?style=for-the-badge" alt="Bundle Size">
  <img src="https://img.shields.io/badge/license-MIT-18181B?style=for-the-badge" alt="MIT License">
</p>

<h1 align="center">@alien-form/core</h1>

<p align="center">
  <b>A headless, signals-driven form engine with a sandboxed expression runtime and declarative schema protocol.</b>
</p>

<p align="center">
  <a href="#installation">Install</a> &#8226;
  <a href="#quick-start">Quick Start</a> &#8226;
  <a href="#architecture">Architecture</a> &#8226;
  <a href="#api-reference">API</a> &#8226;
  <a href="#schema-protocol">Schema Protocol</a> &#8226;
  <a href="./README.zh-CN.md">中文文档</a>
</p>

---

## What is this?

`@alien-form/core` is a **framework-agnostic form state machine** built on top of [`alien-signals`](https://github.com/nicepkg/alien-signals) — arguably the fastest fine-grained reactivity primitive available in JavaScript today.

It provides:

- **Reactive field graph** — every field property (value, display, pattern, errors, loading...) is a signal. Dependencies are tracked automatically.
- **Declarative schema protocol** — describe your form structure, validation, conditional logic, and value transformation as pure JSON. No imperative boilerplate.
- **Sandboxed expression runtime** — a hand-rolled recursive-descent parser that evaluates a safe subset of JavaScript (no `eval`, no `new Function`, no prototype access). Secure by construction.
- **First-class array fields** — push/remove/move/swap rows with automatic child field tree management and path reindexing.
- **Cycle detection** — both static (graph analysis at schema load) and runtime (re-entry & frequency guards). Misconfigured reactions get caught, not infinite-looped.
- **Async-aware reactions** — version-stamped computed handlers that discard stale results, with automatic loading state management.

The entire engine is ~3KB gzipped with a single dependency (`alien-signals`). No React, no DOM, no opinions on UI.

---

## Ecosystem Position

| Layer | Role | Examples |
|-------|------|----------|
| **Schema DSL** | Structure + rules declaration | JSON / TypeScript literal |
| **@alien-form/core** | **State machine + protocol execution** | This package |
| **Binding layer** | Framework glue | `@alien-form/react`, Vue adapter, Svelte adapter |
| **UI components** | Visual rendering | `@alien-form/ui`, Ant Design, your design system |
| **Business logic** | Side effects, API calls | `setup + effect`, computed handlers |

Unlike Formily, React Hook Form, or Final Form — this engine **doesn't know what a DOM is**. It's a pure state orchestrator. Your React/Vue/Svelte binding consumes the signal graph. Your UI components subscribe to field instances. The boundary is absolute.

### Compared to alternatives

| | @alien-form/core | Formily Core | React Hook Form | Final Form |
|---|---|---|---|---|
| Reactivity | alien-signals (fine-grained) | @formily/reactive (MobX-like) | Re-render based | Subscription model |
| Framework coupling | None | None (but heavy React bias) | React only | None |
| Expression safety | Sandboxed parser, no eval | `new Function()` | N/A | N/A |
| Schema protocol | 4 rule types, converged | Extensive, growing | N/A | N/A |
| Bundle size | ~3KB | ~45KB | ~9KB | ~5KB |
| Array support | Built-in controller | Built-in | Plugin | Manual |
| Cycle detection | Static + runtime | Runtime only | N/A | N/A |

---

## Installation

```bash
npm install @alien-form/core
# or
pnpm add @alien-form/core
# or
yarn add @alien-form/core
```

**Peer dependency:** `alien-signals@^3.2.1` (auto-installed).

---

## Quick Start

```typescript
import { createForm } from "@alien-form/core";
import type { IFormSchema } from "@alien-form/core";

// 1. Define schema
const schema: IFormSchema = {
  type: "object",
  required: ["email"],
  properties: {
    email: {
      type: "string",
      title: "Email",
      format: "email",
      component: "Input",
    },
    role: {
      type: "string",
      title: "Role",
      component: "Select",
      dataSource: [
        { label: "Admin", value: "admin" },
        { label: "User", value: "user" },
      ],
    },
    permissions: {
      type: "string",
      title: "Permissions",
      component: "Select",
      "x-reaction": {
        dataSource: {
          type: "match",
          dependencies: { role: "role" },
          source: "$dependencies.role",
          match: {
            admin: [
              { label: "All", value: "*" },
              { label: "Read", value: "read" },
            ],
            user: [{ label: "Read", value: "read" }],
            default: [],
          },
        },
        visible: {
          type: "expression",
          dependencies: ["role"],
          expression: "$deps[0] !== undefined && $deps[0] !== ''",
        },
      },
    },
  },
};

// 2. Create form instance
const form = createForm({
  initialValues: { email: "", role: "user" },
  setup(instance) {
    // Imperative effects for complex business logic
    return instance.effect(
      (f) => f.getField("role")?.value,
      (role, prevRole) => {
        console.log(`Role changed: ${prevRole} -> ${role}`);
      },
    );
  },
});

// 3. Load schema — fields are created, reactions are wired
form.setSchema(schema);

// 4. Interact
form.setValues({ email: "hello@example.com", role: "admin" });
console.log(form.getField("permissions")?.dataSource);
// => [{ label: "All", value: "*" }, { label: "Read", value: "read" }]

// 5. Validate
const valid = await form.validate();
console.log(valid, form.errors);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        createForm(config)                            │
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                          │
│  IForm   │  fields: Map<path, IField>                               │
│          │  values: computed (output-formatted, visible-only)        │
│          │  effect(): alien-signals reactive effect                  │
│          │  subscribe(): notification on any field mutation          │
│          │  setSchema(): full schema load with reaction wiring       │
│          │                                                          │
├──────────┼──────────────────────────────────────────────────────────┤
│          │                                                          │
│  IField  │  signals: value, display, pattern, required, errors...   │
│          │  meta: title, component, decorator, props (cold signal)  │
│          │  arrayController: push/remove/move/swap                   │
│          │  validate(): sync rules + async x-validate               │
│          │                                                          │
├──────────┼──────────────────────────────────────────────────────────┤
│          │                                                          │
│ Runtime  │  x-reaction: field property derivation (effect-based)    │
│          │  x-format: sync input/output value transformation        │
│          │  x-validate: dynamic validation rule derivation           │
│          │  expression: sandboxed parser (no eval/Function)          │
│          │  cycle detection: static graph + runtime guard            │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

### Signal Layout per Field

Each field is backed by **12 signals + 1 meta object** (not 20+ individual signals). The `meta` signal bundles rarely-changing properties (title, description, component, decorator, props) into a single frozen object — read together, updated together. Hot paths like `value`, `display`, `pattern`, `errors` get dedicated signals for minimal re-computation.

---

## API Reference

### `createForm(config?: FormConfig): IForm`

Creates a headless form instance.

```typescript
interface FormConfig {
  initialValues?: Record<string, any>;
  validateFirst?: boolean;
  setup?: (form: IForm) => void | (() => void);
  scope?: Record<string, any>;          // injected into expression runtime
  handlers?: Record<string, RuntimeRuleHandler>;  // computed rule handlers
  onError?: (error: FormError) => void;  // non-fatal runtime errors
}
```

### IForm

| Property / Method | Description |
|---|---|
| `fields` | `Map<string, IField>` — all registered fields |
| `values` | Computed aggregate (output-formatted, visible-only) |
| `valid` / `invalid` | Derived from field errors |
| `errors` | Flattened array of all visible field errors |
| `submitting` | Boolean signal, managed during `submit()` |
| `createField(path, schema, initialValue?)` | Manually register a field |
| `getField(path)` | Lookup by dot-path |
| `setFieldState(path, setter)` | Batch-update field state |
| `setValues(values)` | Bulk set with input formatting |
| `setInitialValues(values)` | Update initial values reference |
| `reset()` | Reset all fields to initial values |
| `validate()` | Validate all visible fields, returns `Promise<boolean>` |
| `submit(onSubmit?)` | Validate + invoke submit handler |
| `setSchema(schema)` | Load/replace full schema, rewires all reactions |
| `effect(runner)` | Reactive effect (alien-signals) |
| `effect(selector, listener, options?)` | Watch + callback pattern |
| `destroy()` | Cleanup all effects and reactions |
| `onError(listener)` | Subscribe to non-fatal runtime errors |

### IField

| Property | Type | Description |
|---|---|---|
| `path` | `string` | Dot-separated field path |
| `value` | `any` | Current value (array fields return collected array) |
| `display` | `"visible" \| "hidden" \| "none"` | Visibility state |
| `pattern` | `"editable" \| "readOnly" \| "disabled" \| "readPretty"` | Interaction pattern |
| `required` | `boolean` | Required flag |
| `errors` / `warnings` | `FieldError[]` | Validation results |
| `validateStatus` | `"" \| "success" \| "error" \| "warning" \| "validating"` | Current status |
| `loading` | `boolean` | Async operation in progress |
| `dataSource` | `Array<{ label, value }>` | Options data |
| `isArrayField` | `boolean` | Whether this is an array container |
| `arrayItems` | `IField[][]` | Child fields grouped by row |

| Method | Description |
|---|---|
| `setValue(value)` | Update value |
| `setState(partial)` | Batch update multiple properties |
| `validate()` | Run validators, returns `Promise<FieldError[]>` |
| `reset()` | Reset to initial value |
| `push(initialValues?)` | Array: append row |
| `remove(index)` | Array: delete row, reindex |
| `moveUp(index)` / `moveDown(index)` | Array: swap adjacent rows |
| `subscribe(listener)` | React to any field change |
| `effect(runner)` | Reactive effect scoped to this field |

---

## Schema Protocol

The schema protocol intentionally uses **only 4 rule types** to keep the declarative surface small and auditable:

### Rule Types

| Type | Purpose | Example |
|---|---|---|
| `static` | Constant value | `{ type: "static", value: true }` |
| `expression` | Sandboxed JS expression | `{ type: "expression", expression: "$deps[0] > 18" }` |
| `match` | Pattern matching (switch-case) | `{ type: "match", source: "$deps.role", match: { admin: true, default: false } }` |
| `computed` | Named handler function (async-capable) | `{ type: "computed", handler: "fetchOptions", params: { api: "/roles" } }` |

### Schema Extensions

| Extension | Purpose | Sync/Async |
|---|---|---|
| `x-reaction` | Derive field properties from dependencies | Both (computed handlers can be async) |
| `x-format` | Transform values on input/output | Sync only |
| `x-validate` | Dynamic validation logic | Both |

### Expression Scope

Expressions have access to these variables:

| Variable | Description |
|---|---|
| `$self` | Current field instance |
| `$form` | Form instance |
| `$values` | Current form values snapshot |
| `$deps` | Resolved dependencies (array or object) |
| `$dependencies` | Resolved dependencies as named object |
| `$value` | Current field value (or pipeline value in x-format) |
| `...scope` | Custom scope from `FormConfig.scope` |

### Expression Safety

The expression runtime is a **hand-rolled recursive-descent parser** that rejects:

- Function calls (`fn()`)
- Template literals (`` ` ``)
- Assignments (`=`, `+=`, etc.)
- Arrow functions (`=>`)
- `globalThis`, `window`, `document`, `process`, `eval`, `constructor`, `prototype`, `__proto__`

This is **not** `eval` with a blocklist. It's a whitelist parser that only recognizes: literals, identifiers, member access, arithmetic, comparison, logical operators, ternary, array/object literals.

---

## Array Fields

Array fields are first-class citizens with a dedicated `ArrayFieldController`:

```typescript
const schema: IFormSchema = {
  type: "object",
  properties: {
    contacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
          phone: { type: "string", title: "Phone", format: "phone" },
        },
      },
    },
  },
};

const form = createForm({
  initialValues: { contacts: [{ name: "Alice", phone: "123" }] },
});
form.setSchema(schema);

const contacts = form.getField("contacts")!;
contacts.push({ name: "Bob", phone: "456" });       // append row
contacts.remove(0);                                   // delete + reindex
contacts.moveDown(0);                                 // swap rows
console.log(contacts.value);                          // collected array
console.log(contacts.arrayItems);                     // [[IField, IField], ...]
```

Row operations automatically:
- Create/destroy child field trees
- Rename paths (reindex) for all descendants
- Notify structure changes to form-level computed values
- Batch signal updates to prevent intermediate renders

---

## Effects & Side Effects

```typescript
const form = createForm({
  setup(instance) {
    // Pattern 1: reactive runner (re-runs when tracked signals change)
    const stop1 = instance.effect((f, ctx) => {
      const role = f.getField("role")?.value;
      if (role === "banned") ctx.stop(); // self-cleanup
    });

    // Pattern 2: selector + listener (only fires on selected value change)
    const stop2 = instance.effect(
      (f) => f.getField("country")?.value,
      (country, prevCountry) => {
        // fetch cities for new country...
      },
      { immediate: true },
    );

    // Return cleanup
    return () => { stop1(); stop2(); };
  },
});
```

Effects are tracked by the form and automatically disposed on `form.destroy()`.

---

## Error Handling

Non-fatal errors (broken expressions, unresolved `$ref`, cycle detection, async reaction failures) are surfaced through the error channel:

```typescript
const form = createForm({
  onError(error) {
    // error.scope: "reaction" | "x-reaction" | "x-format" | "x-validate" | "ref-resolve" | "expression"
    // error.path: field path or ""
    // error.key: reaction key or rule kind
    // error.message: human-readable
    // error.cause: original error object
    analytics.track("form_runtime_error", error);
  },
});
```

If no `onError` listener is registered, errors are printed via `console.warn`.

---

## Design Decisions

1. **4 rule types, no more.** `static`, `expression`, `match`, `computed` cover all declarative needs. Adding rule types is a protocol expansion — it should be rare and deliberate.

2. **x-format is synchronous.** Value transformation happens inline during `setValue`/`setValues`. Async transforms belong in `x-reaction` computed handlers that update the field externally.

3. **No event bus.** There's no `onFieldChange("path", callback)`. Effects track reactive dependencies automatically. This eliminates the "which handler fires first" category of bugs.

4. **Reactions only derive field's own properties.** A reaction on field A cannot directly mutate field B. Cross-field orchestration belongs in `setup + effect`. This makes schemas auditable — each field's behavior is self-contained.

5. **Expression runtime is a parser, not a sandbox.** No `Function()`, no `with()`, no `Proxy` wrapper. The AST is walked synchronously. The attack surface is the parser itself (~380 LOC), which is trivially auditable.

6. **Field signals are memory-optimized.** Hot signals (value, display, pattern) are individual. Cold metadata (title, component, decorator, props) is packed into a single signal object. This reduces per-field overhead by ~40% compared to naive signal-per-property.

---

## Development

```bash
pnpm install
pnpm test:core     # run core tests (vitest)
pnpm build         # tsup → ESM + CJS + DTS
```

### Source Map

```
src/
├── index.ts                      # Public API surface
├── schema/
│   ├── types.ts                  # All type definitions
│   ├── expression.ts             # Sandboxed expression parser + evaluator
│   ├── validation.ts             # Pure validation rule logic
│   ├── normalize.ts              # Schema normalization helpers
│   └── path.ts                   # Path utilities (get/set deep, sort, void detection)
├── engine/
│   ├── form/
│   │   ├── create-form.ts        # Factory entry point
│   │   ├── methods.ts            # All form methods + value collection
│   │   └── internals.ts          # Internal state (signals, Maps, Sets)
│   ├── field/
│   │   ├── create-field.ts       # Field factory
│   │   ├── methods.ts            # Field method bundle
│   │   ├── internals.ts          # Field signal layout
│   │   ├── array-controller.ts   # Array row CRUD + reindexing
│   │   └── validation.ts         # Async validator runner
│   └── runtime/
│       ├── reaction.ts           # Rule resolution, scope building, application
│       └── rule-effect.ts        # Effect installation, cycle detection, sync
└── utils.ts                      # arrayShallowEqual, isPromiseLike, readUntracked
```

---

## License

MIT
