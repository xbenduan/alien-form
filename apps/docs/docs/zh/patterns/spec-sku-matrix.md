# 规格与 SKU 销售矩阵

## 场景

电商后台里很常见这样一类需求：

- 上游先维护规格定义，例如颜色、内存、运行内存
- 下游根据规格值做笛卡尔积，生成 SKU 销售矩阵
- 每个 SKU 行还要继续编辑售价、库存、售卖时间、配件列表等字段
- 某个规格还可能支持图片，并成为整个销售矩阵的主分组规格

这类场景最容易走偏的地方，是把整块业务做成一个超级组件：

```ts
type ProductSpecValue = {
  specs: Array<any>
  skus: Array<any>
}

interface ProductSpecEditorProps {
  value?: ProductSpecValue
  onChange?: (value: ProductSpecValue) => void
}
```

## 反模式 (Anti-Pattern)

### 不要把“规格定义 + SKU 销售配置”折叠成一个对象值组件

这种做法的问题是：

- `specs` 和 `skus` 都失去独立路径
- `price`、`stock`、`startDate` 这类字段没法自然挂校验和错误
- 表格中的任意单元格变化，都会触发整个对象的重组和整块回写
- 规格变化后重新生成笛卡尔积时，旧值保留策略会越来越难维护
- schema 渲染层看到的是一个大字段，失去了字段树驱动的优势

这类场景的复杂度主要来自：

- 规格定义
- SKU 派生
- 分组展示
- 行内编辑

而不是来自“它看起来像一个复杂组件”。

## 标准范式

这类场景推荐拆成 4 层：

1. `specs`：上游规格定义字段树
2. `skus`：下游销售矩阵数组字段
3. `specs -> skus`：控制器层派生逻辑
4. `SkuTable`：数组字段的复杂 UI 渲染器

一句话说就是：

**复杂的是派生逻辑和表格 UI，不是字段协议本身。**

## 推荐建模

### 1. 规格定义是独立数组字段

不要把规格定义藏在某个组件内部状态里，而是直接建成真实字段：

```json
{
  "specs": {
    "type": "array",
    "title": "规格定义",
    "component": "ArrayCards",
    "decorator": "FormItem",
    "items": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "title": "规格名",
          "component": "Input",
          "decorator": "FormItem"
        },
        "supportsImage": {
          "type": "boolean",
          "title": "支持图片",
          "component": "Switch",
          "decorator": "FormItem"
        },
        "values": {
          "type": "array",
          "title": "规格值",
          "component": "ArrayCards",
          "decorator": "FormItem",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string",
                "title": "规格值",
                "component": "Input",
                "decorator": "FormItem"
              },
              "image": {
                "type": "string",
                "title": "规格图片",
                "component": "ImageInput",
                "decorator": "FormItem"
              }
            }
          }
        }
      }
    }
  }
}
```

这里真正被编辑的是：

- `specs.0.name`
- `specs.0.supportsImage`
- `specs.0.values.0.label`
- `specs.0.values.0.image`

而不是某个整体 `productSpecEditor.value`。

### 2. SKU 销售矩阵也是独立数组字段

SKU 表格虽然视觉上很复杂，但底层仍然应该是 `array<object>`：

```json
{
  "skus": {
    "type": "array",
    "title": "规格配置",
    "component": "SkuTable",
    "decorator": "FormItem",
    "items": {
      "type": "object",
      "properties": {
        "skuKey": { "type": "string" },
        "specSummary": { "type": "string" },
        "price": { "type": "number", "component": "Input" },
        "stock": { "type": "number", "component": "Input" },
        "startDate": { "type": "string", "component": "DateInput" },
        "endDate": { "type": "string", "component": "DateInput" },
        "accessories": { "type": "array", "component": "ItemInput" },
        "enabled": { "type": "boolean", "component": "Switch" }
      }
    }
  }
}
```

这里的重点不是组件名字，而是：

- `skus` 是真实字段路径
- 行内每一列仍然是独立字段
- 表格只是这些字段的另一种视觉组织方式

## 派生逻辑应该放在哪里

这类逻辑不属于 schema 表达式，也不属于 React 组件生命周期。

推荐放在：

- `createForm({ effects })`
- 通过 `onFieldChange("specs", ...)` 监听规格变化

例如：

```ts
const form = createForm({
  initialValues: createInitialValues(),
  effects(form) {
    let syncing = false

    const syncSkuMatrix = () => {
      if (syncing) return

      const rawSpecs = form.getField("specs")?.value
      const normalizedSpecs = normalizeSpecs(rawSpecs)
      const currentSkus = Array.isArray(form.getField("skus")?.value)
        ? form.getField("skus")!.value
        : []
      const nextSkus = buildCartesianSpecRows(normalizedSpecs, currentSkus)

      if (JSON.stringify(currentSkus) === JSON.stringify(nextSkus)) return

      syncing = true
      form.setValues({ skus: nextSkus })
      syncing = false
    }

    form.onFieldChange("specs", () => {
      syncSkuMatrix()
    })
  },
})
```

## 为什么不用 `x-reaction`

因为这里不是简单的字段属性联动，而是：

- 读取一个上游数组字段树
- 生成一个下游数组字段树
- 保留旧 SKU 行的已编辑值
- 做主规格分组和图片分组

这已经是控制器层的派生逻辑了，不再适合塞进单字段 reaction。

## 笛卡尔积生成的关键

规格变化后，不应该暴力清空全部销售配置再重建。

推荐做法是：

1. 先根据规格值做笛卡尔积
2. 为每一行生成稳定的 `skuKey`
3. 用 `skuKey` 匹配旧行
4. 命中旧行时保留它的售价、库存、时间和配件等编辑值
5. 只为新组合补默认值

例如：

```ts
function buildSkuKey(combination: Array<{ name: string; label: string }>) {
  return combination.map((item) => `${item.name}=${item.label}`).join("|")
}
```

`skuKey` 是这个场景最重要的锚点之一。

## 图片规格怎么处理

如果某个规格支持图片，它通常会成为整个销售矩阵的主分组规格。

推荐约束是：

- 最多只允许一个规格开启 `supportsImage`
- 若多个规格都被开启，控制器层自动以后开启者为主规格
- `skus` 中额外存一组分组元数据，例如：
  - `groupKey`
  - `groupSpecName`
  - `groupSpecValue`
  - `groupSpecImage`

这样 `SkuTable` 就可以按图片规格值分组展示：

- 组头显示图片和规格值
- 组内继续编辑其他规格组合的销售字段

## `SkuTable` 的职责边界

`SkuTable` 应该是数组字段渲染器，而不是大对象组件。

它应该负责：

- 根据 `skus` 渲染表格或分组表格 UI
- 按组显示图片规格头部
- 逐格承载真实字段的编辑组件

它不应该负责：

- 自己维护 `specs`
- 自己做笛卡尔积
- 自己定义 `value: { specs, skus }` 和 `onChange(nextWholeObject)`

## 推荐职责划分

- schema：
  - 定义 `specs`
  - 定义 `skus`
  - 定义每个销售字段
- form effects：
  - 监听 `specs`
  - 做规格归一化
  - 控制唯一图片规格
  - 生成或重建 `skus`
- `SkuTable`：
  - 负责视觉分组和表格呈现
- 基础字段组件：
  - 负责输入值本身

## 对应 demo

这个范式已经在 demo 中有完整实现，可直接参考：

- `apps/demo/src/schema/07-spec-sku-matrix.json`
- `apps/demo/src/components/schema-renderer.tsx`
- `apps/demo/src/components/sku-table.tsx`

## 一句话原则

**规格定义和 SKU 销售矩阵都应该是字段树。笛卡尔积、图片主规格和旧值保留属于 form 控制器逻辑；表格只是数组字段的复杂 UI，不是超级对象组件。**
