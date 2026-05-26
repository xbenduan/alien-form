# 自定义组件

AlienForm 的自定义组件不是黑盒魔法，它本质上就是：

1. 在 `FormProvider` 中注册一个组件名到 React 组件的映射
2. 在 schema 中通过 `component` 或 `decorator` 引用这个名字
3. 让 React 渲染层把 field 状态转换成统一 props 传进去

这篇文档讲的是**真实运行机制**，而不是抽象概念。

## 注册入口

React 侧真正的注册入口是 `FormProvider`。

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField schema={schema} />
</FormProvider>
```

其中：

- `components`：字段组件与布局组件注册表
- `decorators`：包装器组件注册表

demo 中的真实注册方式可以参考 `apps/demo/src/components/schema-renderer.tsx`。

例如：

```tsx
const components = {
  Input,
  Select,
  ImageInput,
  SkuTable,
  FormLayout,
  FormGrid,
  FormSection,
};

const decorators = {
  FormItem,
};
```

## 普通字段组件契约

普通字段组件的协议非常简单。React 绑定层会把 field 映射成统一 props 传入组件：

- `value`
- `onChange`
- `disabled`
- `readOnly`
- `readPretty`
- `loading`
- `pattern`
- `dataSource`（如果字段存在）
- `componentProps` 中展开出来的属性

也就是说，自定义字段组件本质上应该长成这样：

```tsx
interface ImageInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

而不是自己重新定义一套协议。

## 推荐写法

最标准的自定义字段组件示例就是 demo 中的 `ImageInput`，实现位于 `apps/demo/src/components/image-input.tsx`。

它的特点是：

- 只编辑一个字段值
- 使用标准 `value/onChange`
- 可以有复杂视觉，但不额外创建字段树

对应 schema 写法：

```json
{
  "image": {
    "type": "string",
    "title": "规格图片",
    "component": "ImageInput",
    "decorator": "FormItem",
    "props": {
      "placeholder": "输入图片 URL"
    }
  }
}
```

## 反模式

### 不要把多字段业务塞进一个对象值组件

下面这种做法通常是不推荐的：

```tsx
interface ProductEditorProps {
  value?: {
    name: string;
    price: number;
    stock: number;
  };
  onChange?: (value: any) => void;
}
```

如果这 3 个值都需要：

- 独立路径
- 独立校验
- 独立联动
- 独立错误展示

那它们就应该是字段树，而不是一个对象值组件。

这条边界在范式文档 [复杂组件建模](../../patterns/composite-fields) 里也有更完整说明。

## 包装器组件

如果你的需求不是改字段输入本身，而是改外层包装，比如：

- 标签
- 错误展示
- 提示文案
- 权限包装

那应该优先做 `decorator` 组件，而不是重新写字段组件。

例如：

```json
{
  "name": {
    "type": "string",
    "component": "Input",
    "decorator": "FormItem"
  }
}
```

React 渲染层会先渲染字段组件，再用 `decorator` 包住它。

## 自定义数组组件

数组组件也是自定义组件，但它不是普通字段组件协议。

当字段满足：

- `type: "array"`
- `items.properties` 存在

React 层会走 `ArrayFieldRenderer`，数组组件拿到的是一组数组专用 props：

- `field`
- `rows`
- `onAdd`
- `onRemove`
- `onMoveUp`
- `onMoveDown`
- `disabled`
- `readOnly`
- `readPretty`

这意味着数组组件不是自己维护值列表，而是成为数组字段模型的表现层。

## 推荐数组组件写法

基础数组组件的典型例子：

- `ArrayCards`
- `ArrayTable`

进阶数组组件的例子是 `SkuTable`，实现位于 `apps/demo/src/components/sku-table.tsx`。

`SkuTable` 的关键点不是“它像表格”，而是：

- 它吃的是 `field` 和 `field.arrayItems`
- 它逐格渲染真实字段
- 它不拥有 `skus` 的业务生成逻辑

也就是说，下面这些事不应该由数组组件负责：

- 生成笛卡尔积
- 拼装整块业务对象
- 决定 `specs -> skus` 的派生规则

这些属于 form controller / `setup + form.effect(...)` 层。

## 当前渲染链路

当前项目里，自定义组件的调用链大致是：

1. `FormProvider` 注入 `components/decorators`
2. `SchemaField` 调用 `form.setSchema(schema)`
3. `SchemaFieldItem` 判断节点类型
4. 普通字段走 `FieldRenderer`
5. 数组字段走 `ArrayFieldRenderer`
6. 最终通过 `components[field.component]` 找到 React 组件

关键入口可参考 `packages/react/src/index.tsx`。

## 什么时候需要自定义组件

适合做自定义组件的场景：

- 标准输入框不满足视觉或交互要求
- 你需要一个单值但有增强视觉的控件，例如图片 URL 预览
- 你需要一个数组字段的特殊表现层，例如销售矩阵表格

不适合做自定义字段组件的场景：

- 只是想做分组、卡片、栅格、布局
- 只是想统一标签和错误展示
- 实际上要编辑的是一棵多字段业务树

这些场景应该优先考虑：

- 布局组件
- 包装器组件
- schema 字段树 + controller 逻辑

## 一句话原则

**自定义字段组件仍然应该服从字段协议：普通字段吃 `value/onChange`，数组字段吃 `rows/onAdd/onRemove`。视觉可以复杂，但不要绕开字段树。**
