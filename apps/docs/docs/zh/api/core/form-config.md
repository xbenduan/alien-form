# FormConfig

## 描述

`FormConfig` 是传递给 `createForm(config)` 的配置对象。

## 签名

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

## 属性说明

| 属性名 | 描述 |
| --- | --- |
| `initialValues` | 表单字段的初始值 |
| `validateFirst` | 仅在类型中声明，当前的校验循环暂未完全强制执行该逻辑 |
| `effects` | 在构造函数中运行的生命周期副作用钩子 |
| `scope` | 自定义表达式作用域变量 |
| `handlers` | 注册用于 `computed` 类型联动规则的处理函数 |
| `onError` | 监听运行时协议解析错误的事件回调 |
