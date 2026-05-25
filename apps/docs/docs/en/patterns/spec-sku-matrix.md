# Spec and SKU Sales Matrix

## Scenario

In e-commerce admin systems, this pattern appears frequently:

- Upstream defines specs such as color, storage, and memory
- Downstream builds a Cartesian product from those spec values to generate SKU rows
- Each SKU row still needs editable business fields such as price, stock, sale period, and accessories
- One spec may support images and become the primary grouping dimension of the sales matrix

The easiest wrong turn is to wrap everything into a single mega component:

```ts
type ProductSpecValue = {
  specs: Array<any>;
  skus: Array<any>;
};

interface ProductSpecEditorProps {
  value?: ProductSpecValue;
  onChange?: (value: ProductSpecValue) => void;
}
```

## Anti-Pattern

### Do not collapse "spec definition + SKU sales config" into one object-value component

This creates several problems:

- `specs` and `skus` lose independent field paths
- Fields such as `price`, `stock`, and `startDate` can no longer receive validation and errors naturally
- Any cell edit forces a rebuild of the whole object payload
- Regenerating the Cartesian product while preserving old values becomes harder and harder to maintain
- The renderer only sees one large field and loses the benefit of the field tree

The real complexity here comes from:

- spec definition
- SKU derivation
- grouped display
- row-level editing

not from the fact that the UI looks complex.

## Standard Pattern

Split this scenario into 4 layers:

1. `specs`: the upstream spec definition field tree
2. `skus`: the downstream sales matrix array field
3. `specs -> skus`: controller-level derivation logic
4. `SkuTable`: a complex array-field renderer

In one sentence:

**The complexity belongs to derivation logic and table UI, not to the field protocol itself.**

## Recommended Modeling

### 1. Spec definition is a real array field

Do not hide spec definition inside local component state. Model it as real fields:

```json
{
  "specs": {
    "type": "array",
    "title": "Spec Definition",
    "component": "ArrayCards",
    "decorator": "FormItem",
    "items": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "title": "Spec Name",
          "component": "Input",
          "decorator": "FormItem"
        },
        "supportsImage": {
          "type": "boolean",
          "title": "Supports Image",
          "component": "Switch",
          "decorator": "FormItem"
        },
        "values": {
          "type": "array",
          "title": "Spec Values",
          "component": "ArrayCards",
          "decorator": "FormItem",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string",
                "title": "Value",
                "component": "Input",
                "decorator": "FormItem"
              },
              "image": {
                "type": "string",
                "title": "Image",
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

What is actually edited here is:

- `specs.0.name`
- `specs.0.supportsImage`
- `specs.0.values.0.label`
- `specs.0.values.0.image`

not some opaque `productSpecEditor.value`.

### 2. The SKU sales matrix is also a real array field

Although the UI looks like an editable table, the underlying model should still be `array<object>`:

```json
{
  "skus": {
    "type": "array",
    "title": "SKU Config",
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

The important part is not the component name. The important part is:

- `skus` remains a real field path
- every editable cell is still a real field
- the table is only a visual arrangement of those fields

## Where the derivation logic should live

This logic does not belong in schema expressions, and it does not belong in React lifecycle code.

Prefer:

- `createForm({ setup })`
- listening through `watchFieldValue("specs", ...)`

For example:

```ts
const form = createForm({
  initialValues: createInitialValues(),
  setup(form) {
    let syncing = false;

    const syncSkuMatrix = () => {
      if (syncing) return;

      const rawSpecs = form.getField("specs")?.value;
      const normalizedSpecs = normalizeSpecs(rawSpecs);
      const currentSkus = Array.isArray(form.getField("skus")?.value)
        ? form.getField("skus")!.value
        : [];
      const nextSkus = buildCartesianSpecRows(normalizedSpecs, currentSkus);

      if (JSON.stringify(currentSkus) === JSON.stringify(nextSkus)) return;

      syncing = true;
      form.setValues({ skus: nextSkus });
      syncing = false;
    };

    return form.watchFieldValue(
      "specs",
      () => {
        syncSkuMatrix();
      },
      {
        immediate: true,
        equals: (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
      },
    );
  },
});
```

## Why not `x-reaction`

Because this is not a simple field-attribute reaction. It needs to:

- read one upstream array field tree
- generate another downstream array field tree
- preserve edited values from previous SKU rows
- manage primary-group and image-group behavior

That is controller-level derivation logic, not a single-field reaction.

## The key to Cartesian-product generation

When specs change, do not clear all sales rows and rebuild from scratch blindly.

Prefer this strategy:

1. build the Cartesian product from current spec values
2. generate a stable `skuKey` for each row
3. match existing rows by `skuKey`
4. preserve price, stock, schedule, and accessory values from matched rows
5. only fill defaults for truly new combinations

For example:

```ts
function buildSkuKey(combination: Array<{ name: string; label: string }>) {
  return combination.map((item) => `${item.name}=${item.label}`).join("|");
}
```

`skuKey` is one of the most important anchors in this pattern.

## How to handle image specs

If one spec supports images, it usually becomes the primary grouping dimension of the sales matrix.

Recommended constraints:

- allow at most one spec with `supportsImage`
- if multiple specs are turned on, let controller logic keep only the most recently enabled one
- store extra grouping metadata in `skus`, such as:
  - `groupKey`
  - `groupSpecName`
  - `groupSpecValue`
  - `groupSpecImage`

Then `SkuTable` can render grouped sections:

- group header shows the image and spec value
- rows inside the group keep editing the rest of the sales fields

## Responsibility boundary of `SkuTable`

`SkuTable` should be an array-field renderer, not a mega object editor.

It should:

- render the `skus` array as a table or grouped table
- display image-spec group headers
- host real field editors cell by cell

It should not:

- own `specs`
- build the Cartesian product itself
- expose `value: { specs, skus }` plus `onChange(nextWholeObject)`

## Recommended responsibility split

- schema:
  - defines `specs`
  - defines `skus`
  - defines each sales field
- form setup:
  - listen to `specs`
  - normalize spec values
  - enforce a single image spec
  - generate or rebuild `skus`
- `SkuTable`:
  - handles grouped visual presentation
- base field components:
  - handle the actual values

## Related Demo

This pattern already has a complete demo implementation:

- `apps/demo/src/schema/07-spec-sku-matrix.json`
- `apps/demo/src/components/schema-renderer.tsx`
- `apps/demo/src/components/sku-table.tsx`

## One-Sentence Rule

**Both spec definition and SKU sales matrix should stay as field trees. Cartesian generation, primary image grouping, and old-value preservation belong to the form controller; the table is only a complex UI for an array field, not a mega object component.**
