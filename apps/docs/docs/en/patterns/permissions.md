# Permissions

## Scenario

You need to control field rendering and visibility based on the current user's permission codes rather than on form values.

## Anti-Pattern

Do not swap entire schemas with React conditional rendering just because permissions differ, and avoid repeating the same auth check through many `x-reaction` rules.

```tsx
// ❌ BAD: React conditions are patching schema structure directly
<FormProvider form={form}>
  {hasPermission ? (
    <SchemaField schema={schemaWithSecretField} />
  ) : (
    <SchemaField schema={normalSchema} />
  )}
</FormProvider>
```

## Standard Pattern

Put permission logic in the decorator layer. Wrap the standard `FormItem` with your own authorization logic so the field tree stays stable while the UI layer decides whether a field should render.

### 1. Create a Custom Auth FormItem

Create a wrapper component that checks permissions before rendering the underlying `FormItem`.

```tsx
import { FormItem } from "@alien-form/ui";
import { useAuth } from "@/hooks/useAuth";

export function AuthFormItem(props: any) {
  const auth = useAuth();
  const { code, ...restProps } = props;

  if (code && !auth.hasPermission(code)) {
    return null;
  }

  return <FormItem {...restProps} />;
}
```

### 2. Register and Use in Schema

Register your custom component in the `<FormProvider>` and pass the `code` parameter through `decoratorProps` in your schema.

```tsx
// 1. Register the customized FormItem
const decorators = { FormItem: AuthFormItem };

// 2. Define the schema with `code` injected via decoratorProps
const schema = {
  type: "object",
  properties: {
    secretData: {
      type: "string",
      title: "Secret Data",
      component: "Input",
      decorator: "FormItem",
      decoratorProps: {
        code: "view_secret_data",
      },
    },
  },
};

// 3. Render
export function App() {
  return (
    <FormProvider form={form} decorators={decorators} components={components}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

## Why this is the recommended pattern

- Permission logic stays out of core schema structure.
- The field tree remains stable, so schema does not fragment by user role.
- Decorators naturally integrate with React auth context, hooks, or external stores.
- Standard checks become reusable instead of being rewritten as many field-local reactions.

## One-Sentence Rule

If the rule is about whether a field may be shown to the current user, prefer the decorator layer over React schema switching.
