# Schema

## Description

The schema protocol is the shared language between the core model and the React renderer. It describes structure, UI registration keys, validation, formatting, and reactions.

## Constructor Shape

AlienForm currently uses plain JSON objects rather than a `Schema` class. The effective constructor surface is the root schema object passed to `form.setSchema(schema)` or `<SchemaField schema={schema} />`.

## Core Attributes

| Attribute | Description |
| --- | --- |
| `type` | field schema type |
| `title` | field title |
| `description` | field description |
| `default` | default value |
| `properties` | child schema map |
| `items` | array item schema |
| `component` | field component key |
| `decorator` | field decorator key |
| `props` | component props |
| `decoratorProps` | decorator props |
| `validators` | static validator list |
| `state` | initial display and pattern state |
| `dataSource` | option list |
| `x-reaction` | runtime reaction rules |
| `x-format` | input/output formatting rules |
| `x-validate` | dynamic validation rules |
| `definitions` | root reusable schema definitions |
| `$ref` | local reference to `#/definitions/Name` |

## Behavior Notes

- `enum` and `dataSource` both become `field.dataSource`.
- `$ref` is local-only and root-definition-only.
- `void` nodes are layout nodes and do not contribute values to `form.values`.
