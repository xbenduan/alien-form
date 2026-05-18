# FormBao

FormBao is an enterprise-oriented Schema Form engine built around JSON Schema, a headless core, React bindings, UI components, and documentation examples.

## Highlights

- Natural protocol fields: `component`, `props`, `decorator`, `dataSource`, and `validators`.
- Field-owned property-level `x-reaction` with exactly four rule types: `static`, `expression`, `match`, and `computed`.
- Safe expressions without arbitrary script execution.
- Framework separation: core and React bindings are independent, leaving room for Vue, Solid, and community bindings.
- Enterprise auditability: async requests are owned by application-level `handlers`; core does not fetch URLs.
