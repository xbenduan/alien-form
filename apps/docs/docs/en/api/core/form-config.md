# FormConfig

## Description

`FormConfig` is the configuration object passed to `createForm(config)`.

## Signature

```ts
interface FormConfig {
  initialValues?: Record<string, any>
  validateFirst?: boolean
  effects?: (form: IForm) => void
  scope?: Record<string, any>
  handlers?: Record<string, RuntimeRuleHandler>
  onError?: (error: FormError) => void
}
```

## Attributes

| Property | Description |
| --- | --- |
| `initialValues` | initial field values |
| `validateFirst` | declared in types, not fully enforced by the current validation loop |
| `effects` | lifecycle setup hook that runs in the constructor |
| `scope` | custom expression scope variables |
| `handlers` | registry for `computed` rules |
| `onError` | listener for runtime protocol errors |
