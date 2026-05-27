# Higher-Order Components

Higher-order components in AlienForm are "components that return component values" — they exist as containers that wrap and organize child fields. Depending on `type`, there are three forms corresponding to three scenarios.

## Three Forms at a Glance

| Form | Schema Structure | Path Behavior | Value Behavior | Scenario |
| --- | --- | --- | --- | --- |
| Group container | `void + component + properties` | Path-transparent, children inherit parent prefix | No value output | Cards, grids, steps, collapse panels |
| Object container | `object + component + properties` | Contributes path prefix | Children aggregate into this object | Address groups, contact info, nested config |
| Array container | `array + component + items` | Contributes path prefix + row index | Children aggregate into array | Dynamic tables, add/remove lists, spec matrices |

---

## 1. Group Container: `void + component + properties`

**Purpose:** Pure UI grouping. Produces no value; child paths do not include its key.

```json
{
  "basicCard": {
    "type": "void",
    "title": "Basic Info",
    "component": "Card",
    "props": { "bordered": true },
    "properties": {
      "name": { "type": "string", "component": "Input" },
      "age": { "type": "number", "component": "NumberInput" }
    }
  }
}
```

**Result:**
- Child paths: `name`, `age` (not `basicCard.name`)
- `form.values`: `{ name: "John", age: 28 }`
- `Card` component receives `title`, `children`

**Characteristics:**
- Path-transparent — `void` key does not participate in path construction
- Multi-level void nesting is also transparent
- void node is registered in the render tree (React can locate it) but not in the value tree

**Typical components:** `Card`, `FormSection`, `FormGrid`, `FormTab`, `FormStep`, `Collapse`

---

## 2. Object Container: `object + component + properties`

**Purpose:** Wrap a group of fields into a structured object value. Children\'s paths are prefixed with this node\'s key; values aggregate under it.

```json
{
  "address": {
    "type": "object",
    "title": "Shipping Address",
    "component": "AddressGroup",
    "properties": {
      "province": { "type": "string", "component": "Select" },
      "city": { "type": "string", "component": "Select" },
      "detail": { "type": "string", "component": "Input" }
    }
  }
}
```

**Result:**
- Child paths: `address.province`, `address.city`, `address.detail`
- `form.values`: `{ address: { province: "...", city: "...", detail: "..." } }`
- `AddressGroup` component receives `children` (child fields inside)

**Characteristics:**
- Path has prefix — `object` key appears in all child paths
- Value is a nested object
- Component can handle layout and business logic (e.g., cascading selects)

**Typical components:** `AddressGroup`, `ContactInfo`, `ConfigPanel`, custom composite editors

---

## 3. Array Container: `array + component + items`

**Purpose:** Wrap a dynamically add/remove array field. Each row expands the `items` schema.

```json
{
  "contacts": {
    "type": "array",
    "title": "Contact List",
    "component": "ArrayTable",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "component": "Input" },
        "phone": { "type": "string", "component": "Input" }
      }
    }
  }
}
```

**Result:**
- Row child paths: `contacts.0.name`, `contacts.0.phone`, `contacts.1.name`...
- `form.values`: `{ contacts: [{ name: "...", phone: "..." }, ...] }`
- `ArrayTable` can call `field.push()`, `field.remove(index)`, etc.

**Characteristics:**
- Path includes row index — `arrayKey.{index}.childKey`
- Supports `push`/`remove`/`moveUp`/`moveDown`
- items can be simple type (no row field expansion) or object (full row field tree)

**Typical components:** `ArrayTable`, `ArrayCards`, `DynamicList`, `SkuMatrix`

---

## Comparison

| Dimension | `void` Group | `object` Object | `array` Array |
| --- | --- | --- | --- |
| Has own value | No | Yes (object) | Yes (array) |
| Children paths include key | No (transparent) | Yes | Yes |
| Children value/onChange | Independent | Independent, aggregated to object | Independent, aggregated to array |
| Can add/remove rows | No | No | Yes |
| Component receives field instance | No | Yes | Yes (with array methods) |

---

## Decision Tree

```
Do you need a visible container to organize fields?
├─ No → No HOC needed, use field components directly
├─ Yes → Should the container produce a value in form.values?
│  ├─ No → void (group container)
│  └─ Yes → Is the value an object or array?
│     ├─ Object → object (object container)
│     └─ Array → array (array container)
```

---

## Component Interface Spec

### Group Container (void node)

```tsx
interface GroupComponentProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  // + schema.props
}
```

Does NOT receive `field` instance or `value`/`onChange`.

### Object Container (object node)

```tsx
interface ObjectComponentProps {
  field: IField;
  children?: React.ReactNode;
  // + schema.props
}
```

Receives `field` instance (can read `field.value` etc.), but value editing happens through child fields.

### Array Container (array node)

```tsx
interface ArrayComponentProps {
  field: IField;
  // + schema.props
}
// field.push(), field.remove(i), field.moveUp(i), field.moveDown(i)
// field.arrayItems → row field matrix
```

Receives `field` instance; controls row add/remove/move via array methods.

---

## Design Principles

1. **HOCs are containers, not business editors.** They organize and present child fields; they should not maintain independent business state.
2. **Choose the right type = choose the right path and value semantics.** void = transparent grouping, object = object aggregation, array = array aggregation.
3. **Don\'t force simple fields into HOCs.** If you just need to edit a string/number, use a field component directly.
