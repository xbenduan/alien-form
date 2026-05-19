# Permissions & Visibility

## The Scenario

You need to control the rendering and visibility of specific form fields based on the current user's permission codes, rather than just form data.

## The Anti-Pattern

Do not use React conditional rendering to swap entire schemas based on permissions, and avoid littering your schemas with repetitive `x-reaction` expressions for standard auth checks.

```tsx
// ❌ BAD: Mixing React logic with schema structure
<FormProvider form={form}>
  {hasPermission ? (
    <SchemaField schema={schemaWithSecretField} />
  ) : (
    <SchemaField schema={normalSchema} />
  )}
</FormProvider>
```

## The Standard Pattern

Customize the decorator (e.g., `FormItem`) directly. By wrapping the standard `FormItem` with your own authorization logic, you can seamlessly intercept and hide components that the user isn't allowed to see.

### 1. Create a Custom Auth FormItem

Create a custom wrapper component that checks permissions before rendering the underlying `FormItem`.

```tsx
import { FormItem } from "@alien-form/ui";
import { useAuth } from "@/hooks/useAuth"; // Assume you have a custom auth hook

export function AuthFormItem(props: any) {
  const auth = useAuth();
  const { code, ...restProps } = props;

  // If the field requires a permission code and the user lacks it, render nothing.
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
        code: "view_secret_data", // The permission code
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

### Why do it this way?

- **Decoupling**: Permission logic is decoupled from the core business schema structure.
- **Clean Schemas**: You don't need to write long, repetitive `x-reaction` visibility rules for every secure field.
- **React Ecosystem Integration**: Authentication logic naturally lives in the UI rendering layer, making it easy to consume React Context, Hooks, or Redux/Zustand stores directly.
