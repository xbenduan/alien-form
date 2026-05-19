# Edit Initialization

## Scenario

An edit page needs to fetch detail data first, then hydrate the form with existing values. Typical examples:

- editing a user profile
- editing a project configuration
- editing an order draft

The key is not "how to stuff values into schema", but **fetch detail first, then mount the form surface**.

## Anti-Pattern

### 1. Do not fetch edit detail inside schema

`schema` is responsible for field structure, reactions, and validation. It should not own page-level control flow such as edit-detail fetching.

So do not try to:

- fetch the whole record through `x-reaction`
- wait for async detail inside `x-format`
- render an empty form first and patch edit values into it later

### 2. Do not mount an empty form first and treat it as edit mode

```tsx
// ❌ Not recommended: mount an empty form first, then patch values later
const form = useMemo(() => createForm(), []);

useEffect(() => {
  fetch(`/api/users/${id}`)
    .then((res) => res.json())
    .then((detail) => {
      form.setInitialValues(detail);
      form.setValues(detail);
    });
}, [id, form]);

return (
  <FormProvider form={form} components={components} decorators={decorators}>
    <SchemaField schema={schema} />
  </FormProvider>
);
```

Problems with this approach:

- the first paint is a blank "create-mode" form
- the edit page flickers from empty values to patched values
- page-level loading and form-level rendering become mixed together

## Standard Pattern

Split detail fetching and form rendering into two layers:

1. the outer page owns `fetch` and `loading`
2. before `loading` finishes, do not render the form component
3. after detail is ready, mount the real edit form component
4. let the form be created with edit-mode initial values from the start

### 1. Let the page layer own fetching and loading

```tsx
function UserEditPage({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    let disposed = false;

    async function load() {
      setLoading(true);
      const response = await fetch(`/api/users/${id}`);
      const data = await response.json();
      if (!disposed) {
        setDetail(data);
        setLoading(false);
      }
    }

    load();
    return () => {
      disposed = true;
    };
  }, [id]);

  if (loading) {
    return <PageLoading />;
  }

  if (!detail) {
    return <Empty description="Record not found" />;
  }

  return <UserEditForm detail={detail} />;
}
```

### 2. Let the form layer render edit mode only

```tsx
function UserEditForm({ detail }: { detail: any }) {
  const form = useMemo(
    () =>
      createForm({
        initialValues: detail,
      }),
    [detail],
  );

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

The important part of this pattern:

- `initialValues` already exists when the form component mounts
- fields are created directly with edit-mode initial values
- users do not see an empty form before data is filled in

## If the detail refreshes in the same form instance

If your page does not unmount the form component and instead refreshes the record inside the same instance, update both:

- `form.setInitialValues(detail)`
- `form.setValues(detail)`

```tsx
useEffect(() => {
  if (!detail) return;
  form.setInitialValues(detail);
  form.setValues(detail);
}, [detail, form]);
```

These two methods have different responsibilities:

- `setInitialValues()`: updates the reset baseline
- `setValues()`: writes the current values into existing fields

If you call only `setValues()`, the UI will show edit values, but a later `reset()` may still go back to an old initial snapshot.

## Why this is the recommended pattern

- page-level loading and form-level state stay clearly separated
- schema remains pure and focused on field protocol
- the edit page avoids empty-value flicker on first paint
- `reset()` can correctly return to the server detail snapshot
- create mode and edit mode can share one schema, while the outer controller decides when the form should mount

## One-line Rule

**Edit initialization belongs to page/controller logic, not schema logic. Fetch first, wait for loading to finish, then mount the form and pass the detail in as the form's initial values.**
