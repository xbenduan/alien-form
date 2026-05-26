# Mode Switching

## Scenario

Many enterprise forms do not have a single fixed shape. They switch between modes, for example:

- create / edit / readonly
- draft / published
- internal view / external view

These scenarios usually share the same characteristics:

- the schema structure is mostly stable
- but `scope`, reaction results, readonly behavior, helper text, and visibility change with the current mode

## Anti-Pattern

### 1. Do not patch an old form instance repeatedly

For example, watching `mode` in React and mutating an existing form over and over:

```tsx
// ❌ Not recommended: continuously patch the old form instance
const form = useMemo(() => createForm(), []);

useEffect(() => {
  form.setFieldState("name", (state) => {
    state.pattern = mode === "readonly" ? "readOnly" : "editable";
  });
  form.setFieldState("description", (state) => {
    state.componentProps = {
      ...state.componentProps,
      placeholder: mode === "readonly" ? "Readonly mode" : "Please enter content",
    };
  });
}, [mode, form]);
```

Problems with this approach:

- the source of truth after mode switching becomes unclear
- it is easy to forget some fields and leave stale state behind
- `scope` changes and field-state mutations get mixed together
- schema reactions may already depend on `mode`, yet React still has to patch fields manually

### 2. Do not treat `mode` as a normal form value

If `mode` is only a page shape and not user-submitted data, it should not be mixed into `form.values`.

## Standard Pattern

Treat `mode` as external runtime context and inject it through `scope`.

When `mode` changes, create a new form instance directly:

```tsx
const form = useMemo(
  () =>
    createForm({
      scope: { mode },
      initialValues,
    }),
  [mode],
);
```

This pattern means:

1. `mode` is runtime context, not user input
2. schema reactions derive behavior from the `mode` value injected by `createForm({ scope })`
3. when the form shape changes fundamentally, switch to a new form instance

## Recommended Pattern

### 1. Let the page own `mode`

```tsx
function UserPage({ mode }: { mode: "create" | "edit" | "readonly" }) {
  const form = useMemo(
    () =>
      createForm({
        scope: { mode },
        initialValues: getInitialValues(mode),
      }),
    [mode],
  );

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

### 2. Let the schema express how `mode` affects the UI

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Name",
      "component": "Input",
      "decorator": "FormItem",
      "x-reaction": {
        "pattern": {
          "type": "expression",
          "expression": "mode === 'readonly' ? 'readOnly' : 'editable'"
        },
        "props": {
          "type": "expression",
          "expression": "{ placeholder: mode === 'readonly' ? 'Readonly mode' : 'Please enter your name' }"
        }
      }
    }
  }
}
```

The schema is then responsible for:

- deciding field behavior from `mode`
- switching `pattern`
- deriving placeholder text, button text, and visibility

instead of React `useEffect` patching fields one by one.

## Why this is the recommended pattern

- the source of `mode` is explicit: it is external context, not user input
- a form instance corresponds to one runtime `scope`, so old state does not leak across modes
- schema reactions can naturally derive behavior from `mode`
- the React layer only recreates the form, instead of patching the field tree manually

## When to recreate the form

Prefer recreating the form when:

- create mode switches to readonly mode
- edit mode switches to readonly mode
- the overall interaction semantics of the page have changed
- a large set of reactions, patterns, and props depend on `mode`

This is effectively a runtime-context switch, not a minor field tweak.

## When not to recreate the form

If the change is only local, such as:

- toggling extra fields on a switch
- switching select options based on category
- showing or hiding one section based on a field value

then you should still prefer:

- `x-reaction`
- `form.setFieldState`
- array field operations

instead of promoting it to a full form-level `mode` switch.

## Relationship with edit initialization

If your page needs both mode switching and edit initialization, the recommended composition is:

```tsx
function UserForm({ mode, detail }: { mode: "edit" | "readonly"; detail: any }) {
  const form = useMemo(
    () =>
      createForm({
        scope: { mode },
        initialValues: detail,
      }),
    [mode, detail],
  );

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

In other words:

- `detail` determines initial data
- `mode` determines runtime shape
- both should be decided when creating the form

## One-Sentence Rule

**Mode switching is not about patching field state on an old form. It is about recreating a new form with the corresponding runtime `scope`: `useMemo(() => createForm({ scope: { mode } }), [mode])`.**
