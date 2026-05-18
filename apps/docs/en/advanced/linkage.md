# Field Linkage

FormBao implements the full Formily `x-reactions` protocol. Reactions are set up by `Form._setupFieldReactions()` during `setSchema()`, using Alien Signals `effect()` for reactivity.

## Active Mode

The field declaring `x-reactions` controls a **target** field:

```json
{
  "isVip": {
    "type": "boolean",
    "x-component": "Switch",
    "x-reactions": {
      "target": "vipCode",
      "fulfill": {
        "state": { "display": "visible", "required": true }
      },
      "otherwise": {
        "state": { "display": "none", "required": false }
      }
    }
  }
}
```

Internally, `_setupActiveReaction()` creates an `effect()` that:
1. Reads `$self.value` (the Switch field)
2. Resolves the target path
3. Evaluates `when` (defaults to `$self.value` truthiness if omitted)
4. Applies `fulfill` or `otherwise` branch to the target

## Passive Mode

The field with `x-reactions` **reacts to its dependencies**:

```json
{
  "city": {
    "x-reactions": {
      "dependencies": { "country": "country" },
      "when": "{{$deps.country === 'cn'}}",
      "fulfill": {
        "schema": {
          "x-component-props": { "placeholder": "Select Chinese city" }
        }
      },
      "otherwise": {
        "schema": {
          "x-component-props": { "placeholder": "Select city" }
        }
      }
    }
  }
}
```

`_setupPassiveReaction()` reads dependency field values inside an `effect()`, so it re-runs whenever a dependency changes.

## Expression Strings

A reaction can be a bare expression string:

```json
{ "x-reactions": "{{$self.value = $values.firstName + ' ' + $values.lastName}}" }
```

This is handled by `_setupExpressionReaction()`.

## Dependencies Format

**Array form** — values accessible via `$deps[index]`:

```json
{ "dependencies": ["fieldA", "fieldB"] }
```

**Object form** — values accessible via `$deps.alias`:

```json
{ "dependencies": { "myAlias": "some.field.path" } }
```

## Expression Scope

Built by `_buildScope()`:

| Variable | Value |
|----------|-------|
| `$self` | The field declaring the reaction |
| `$form` | The form instance |
| `$values` | `form.values` |
| `$deps` | Resolved dependency values (array or object) |
| `$dependencies` | Always object form |
| `$target` | Target field (active) or self (passive) |
| Custom scope | Merged from `FormConfig.scope` |

## Branch Actions

Each branch (`fulfill` / `otherwise`) can contain:

### `state`

Calls `targetField.setState()`:

```json
{ "state": { "display": "visible", "required": true, "value": "{{$deps[0] * 2}}" } }
```

Expression values (double-brace syntax) in state are evaluated via `_evalInScope()`.

### `schema`

Updates schema-derived properties:

```json
{
  "schema": {
    "title": "New Title",
    "x-component-props": { "placeholder": "..." },
    "x-decorator-props": { "style": {} },
    "enum": ["a", "b", "c"],
    "x-display": "hidden",
    "x-pattern": "readOnly",
    "required": true
  }
}
```

### `run`

Executes arbitrary JavaScript with scope:

```json
{ "run": "$target.setDataSource([{label:'A',value:'a'}])" }
```

## Relative Paths

Inside array items, use `.` prefix for sibling references:

```json
{ "target": ".shipping" }
```

Resolved by `_resolveFieldPath()`: strips the last segment from `selfPath` and appends the relative path.

## Multiple Reactions

```json
{
  "x-reactions": [
    { "target": "fieldA", "fulfill": { "state": { "visible": true } } },
    { "target": "fieldB", "fulfill": { "state": { "disabled": true } } }
  ]
}
```
