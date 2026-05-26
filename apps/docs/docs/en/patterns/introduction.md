# Development Patterns

This section collects the recommended solutions for recurring enterprise form scenarios in AlienForm.

These pages are not presented as interchangeable options. They exist to standardize where logic should live so teams can keep a consistent implementation style across schema, `setup`, React, decorators, and business handlers.

## How to Read This Section

Recommended order:

1. Read the `Guide` first and build the base mental model of `core / react / ui` and `setup + form.effect(...)`.
2. Then open the matching pattern for the business scenario you are solving.
3. Return to the `API` pages when you need exact contracts or runtime behavior.

## What These Patterns Solve

Patterns mainly answer where business logic should be placed in scenarios such as:

- edit initialization
- mode switching
- permissions and visibility
- async data
- composite field modeling
- spec and SKU sales matrices

Each page is organized to answer the same set of questions:

- what the scenario is
- what the anti-pattern looks like
- where the recommended solution should live
- why that solution matches the current runtime model

## One-Sentence Rule

Decide first whether the logic belongs to schema, `setup`, decorator, or business handler, and only then choose the concrete implementation.
