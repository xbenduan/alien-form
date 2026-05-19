# Composite Field Modeling

## Scenario

You want to build a "complex component" that visually looks like one card or panel, for example:

- a user info card: name, age, city
- an address block: province, city, district, detail
- a contact panel: name, phone, email

It is tempting to design it as one object-valued component:

```ts
type UserCardValue = {
  name: string;
  age: number;
  city: string;
};

interface UserCardProps {
  value?: UserCardValue;
  onChange?: (value: UserCardValue) => void;
}
```

## Anti-Pattern

### Do not collapse multi-field editing into one object-valued component

```tsx
// ❌ Not recommended: force 3 fields into one object value/onChange contract
function UserCard({ value, onChange }: UserCardProps) {
  return (
    <>
      <input
        value={value?.name ?? ""}
        onChange={(e) => onChange?.({ ...value, name: e.target.value } as UserCardValue)}
      />
      <input
        value={value?.age ?? 0}
        onChange={(e) => onChange?.({ ...value, age: Number(e.target.value) } as UserCardValue)}
      />
      <input
        value={value?.city ?? ""}
        onChange={(e) => onChange?.({ ...value, city: e.target.value } as UserCardValue)}
      />
    </>
  );
}
```

Problems with this design:

- schema cannot describe validation and reactions for `name`, `age`, and `city` independently
- error state can only hang on the whole object widget, which is too coarse
- `x-reaction`, `x-validate`, and `required` cannot naturally target child fields
- any child change rebuilds and writes back the whole object
- the renderer only sees one big field and loses the benefit of a field tree

## Standard Pattern

**The UI may be visually complex, but the data should not pretend to be one field.**

The recommended approach:

1. use schema layout nodes for the container
2. use primitive fields for each editable value
3. if you need cards, grids, or section titles, use layout components such as `FormSection`, `FormGrid`, or `FormLayout`

## Recommended Shape

### 1. Let schema split the fields

```json
{
  "type": "object",
  "properties": {
    "profile": {
      "type": "void",
      "title": "User Info",
      "component": "FormSection",
      "props": {
        "bordered": true
      },
      "properties": {
        "grid": {
          "type": "void",
          "component": "FormGrid",
          "props": {
            "columns": 2,
            "gap": 4
          },
          "properties": {
            "name": {
              "type": "string",
              "title": "Name",
              "component": "Input",
              "decorator": "FormItem",
              "required": true
            },
            "age": {
              "type": "number",
              "title": "Age",
              "component": "Input",
              "decorator": "FormItem",
              "props": {
                "type": "number"
              }
            },
            "city": {
              "type": "string",
              "title": "City",
              "component": "Input",
              "decorator": "FormItem"
            }
          }
        }
      }
    }
  }
}
```

What is actually edited here is:

- `name`
- `age`
- `city`

not some synthetic `profileValue` object field.

### 2. Let layout components own visual structure only

Components like `FormSection` and `FormGrid` should only handle:

- titles
- grouping
- columns
- card containers
- spacing and arrangement

They should not own the business data for the whole block, and they should not define an object-shaped `value/onChange` protocol by themselves.

## Why this is the recommended pattern

- each child field has an independent path for validation, reactions, submission, and error display
- schema can naturally express `required`, `x-reaction`, and `x-validate`
- the React renderer can reuse the existing field rendering pipeline directly
- even when the page is visually complex, the architecture still stays "layout is layout, fields are fields"
- adding a new piece of data later only means adding one schema node, not rewriting one giant component contract

## If you really want a "complex visual component"

Prefer building a **layout component**, not an **object field component**.

For example:

```tsx
function ProfileCard(props: { title?: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4 space-y-4">
      {props.title && <h3 className="text-base font-semibold">{props.title}</h3>}
      {props.children}
    </section>
  );
}
```

Then use it as a `void` layout component in schema, instead of making it consume:

```ts
value: {
  (name, age, city);
}
onChange: (next) => {};
```

## When an object-valued component is actually reasonable

A single component is only appropriate when the value is truly an **atomic business value**. For example:

- a date-range picker that outputs `[start, end]`
- a coordinate picker that outputs `{ lng, lat }`
- a rich text editor that outputs a whole HTML / JSON document

The judgment standard is not "the UI looks complex", but:

- does schema need to validate child pieces independently?
- do reactions need to respond to child pieces independently?
- is the submitted value naturally one indivisible payload?

If child parts still need independent field management, then do not build an object-valued component.

## One-line Rule

**Complex UI can be modeled as a layout component. Complex data should not be disguised as one field component. If it can be expressed as a field tree, do not squeeze it into `value(object) + onChange(object)`.**
