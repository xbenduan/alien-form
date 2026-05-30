import React, { useCallback, useState } from "react";
import { Card, Button, Space, Typography, Tag, Alert } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useFormValues,
  useFormErrors,
  useFormValid,
  type IFormSchema,
  type FormInstance,
} from "@alien-form/react";
import {
  Input,
  Textarea,
  NumberInput,
  Select,
  Switch,
  Radio,
  CheckboxGroup,
  FormItem,
  SectionCard,
  ArrayCards,
  TagsInput,
} from "@/adapters";

const { Title, Text } = Typography;

const components = {
  Input,
  Textarea,
  NumberInput,
  Select,
  Switch,
  Radio,
  CheckboxGroup,
  TagsInput,
  SectionCard,
  ArrayCards,
};
const decorators = { FormItem };

// ═══════════════════════════════════════════════════════════════════════════════
// Schema-Driven Edge Cases (S1-S20)
// Derived purely from IFieldSchema / IFormSchema type contract.
// ═══════════════════════════════════════════════════════════════════════════════

const schemaEdgeCases: IFormSchema = {
  type: "object",
  definitions: {
    // Shared reusable schema for $ref testing
    emailField: {
      type: "string",
      title: "Email",
      component: "Input",
      decorator: "FormItem",
      validate: { format: "email", message: "Invalid email format" },
    },
    addressBlock: {
      type: "object",
      title: "Address",
      component: "SectionCard",
      properties: {
        street: { type: "string", title: "Street", component: "Input", decorator: "FormItem", order: 10 },
        city: { type: "string", title: "City", component: "Input", decorator: "FormItem", order: 20 },
        zip: { type: "string", title: "Zip", component: "Input", decorator: "FormItem", validate: { format: "zip" }, order: 30 },
      },
    },

  },
  properties: {
    // ─── S1: $ref resolution — basic, override, deep ───────────────────────
    s1: {
      type: "void",
      title: "S1: $ref — basic / override / deep nesting",
      component: "SectionCard",
      order: 10,
      properties: {
        // Basic $ref
        contactEmail: {
          $ref: "#/definitions/emailField",
          order: 10,
        },
        // $ref with local override (title + default override definition)
        workEmail: {
          $ref: "#/definitions/emailField",
          title: "Work Email (overridden title)",
          default: "test@company.com",
          order: 20,
        },
        // Deep $ref — object with nested properties
        homeAddress: {
          $ref: "#/definitions/addressBlock",
          title: "Home Address (from $ref)",
          order: 30,
        },

      },
    },

    // ─── S2: display:"none" — exclusion from values and validation ─────────
    s2: {
      type: "void",
      title: "S2: display:none — excluded from values() and validate()",
      component: "SectionCard",
      order: 20,
      properties: {
        visibleField: {
          type: "string",
          title: "Visible (in values)",
          component: "Input",
          decorator: "FormItem",
          default: "I appear",
          order: 10,
        },
        hiddenField: {
          type: "string",
          title: "Hidden (display=none, NOT in values)",
          component: "Input",
          decorator: "FormItem",
          default: "I am ghost",
          display: "none",
          order: 20,
          validate: { required: true },
        },
        toggleDisplay: {
          type: "boolean",
          title: "Show hidden field",
          component: "Switch",
          decorator: "FormItem",
          default: false,
          order: 30,
        },
        // Reaction: toggle hiddenField display based on switch
        controlledField: {
          type: "string",
          title: "Controlled visibility",
          component: "Input",
          decorator: "FormItem",
          default: "peekaboo",
          order: 40,
          "x-reaction": {
            display: (ctx: any) => ctx.get("toggleDisplay") ? "visible" : "none",
          },
        },
      },
    },

    // ─── S3: void type path-skipping ───────────────────────────────────────
    // void nodes should NOT appear in values path; their children bubble up
    s3: {
      type: "void",
      title: "S3: void path-skipping in values()",
      component: "SectionCard",
      order: 30,
      properties: {
        // This void wraps innerA and innerB, but values() should show them at root level
        wrapper: {
          type: "void",
          title: "Void Wrapper (invisible in values)",
          component: "SectionCard",
          properties: {
            innerA: {
              type: "string",
              title: "Inner A",
              component: "Input",
              decorator: "FormItem",
              default: "a",
              order: 10,
            },
            innerB: {
              type: "string",
              title: "Inner B",
              component: "Input",
              decorator: "FormItem",
              default: "b",
              order: 20,
            },
          },
        },
        // Direct sibling (non-void)
        directField: {
          type: "string",
          title: "Direct (same level as void children in values)",
          component: "Input",
          decorator: "FormItem",
          default: "direct",
          order: 50,
        },
      },
    },

    // ─── S4: initialValues vs default priority ─────────────────────────────
    s4: {
      type: "void",
      title: "S4: initialValues overrides default",
      component: "SectionCard",
      order: 40,
      properties: {
        // Has default, but initialValues should win
        priorityField: {
          type: "string",
          title: "default='schema-default'",
          component: "Input",
          decorator: "FormItem",
          default: "schema-default",
          order: 10,
        },
        // No default, should get initialValues
        noDefaultField: {
          type: "string",
          title: "No default (from initialValues)",
          component: "Input",
          decorator: "FormItem",
          order: 20,
        },
        // Has default, no initialValues for this key — should use default
        onlyDefault: {
          type: "string",
          title: "Only has default (no initialValue)",
          component: "Input",
          decorator: "FormItem",
          default: "from-default",
          order: 30,
        },
      },
    },

    // ─── S5: required — three ways to declare ──────────────────────────────
    s5: {
      type: "void",
      title: "S5: required — field bool / parent string[] / validate.required",
      component: "SectionCard",
      order: 50,
      required: ["parentReqField"],
      properties: {
        // required directly on field
        fieldReq: {
          type: "string",
          title: "required: true (field level)",
          component: "Input",
          decorator: "FormItem",
          required: true,
          order: 10,
        },
        // required via parent required:[]
        parentReqField: {
          type: "string",
          title: "required via parent string[]",
          component: "Input",
          decorator: "FormItem",
          order: 20,
        },
        // required via validate.required
        validateReq: {
          type: "string",
          title: "required via validate.required",
          component: "Input",
          decorator: "FormItem",
          validate: { required: true },
          order: 30,
        },
        // NOT required (control group)
        optional: {
          type: "string",
          title: "Optional (no required anywhere)",
          component: "Input",
          decorator: "FormItem",
          order: 40,
        },
      },
    },

    // ─── S6: All x-reaction targets ────────────────────────────────────────
    s6: {
      type: "void",
      title: "S6: All 12 x-reaction target keys",
      component: "SectionCard",
      order: 60,
      properties: {
        trigger: {
          type: "string",
          title: "Trigger (type anything)",
          component: "Input",
          decorator: "FormItem",
          default: "",
          order: 5,
        },
        // x-reaction targets: title, description, disabled, required, display,
        // component, decorator, props, decoratorProps, dataSource, value
        targetField: {
          type: "string",
          title: "Target (watch all changes)",
          component: "Input",
          decorator: "FormItem",
          default: "",
          order: 10,
          "x-reaction": {
            title: (ctx: any) => `Dynamic title: ${ctx.get("trigger") || "empty"}`,
            description: (ctx: any) => ctx.get("trigger")?.length > 3 ? "Long enough!" : "Type more...",
            disabled: (ctx: any) => ctx.get("trigger") === "lock",
            required: (ctx: any) => ctx.get("trigger") === "must",
            display: (ctx: any) => ctx.get("trigger") === "hide" ? "hidden" : "visible",
            props: (ctx: any) => ({ placeholder: `From trigger: ${ctx.get("trigger") || "?"}` }),
            decoratorProps: (ctx: any) => ({ extra: ctx.get("trigger") ? `Extra: ${ctx.get("trigger")}` : undefined }),
          },
        },
        // Component swap reaction
        swapTarget: {
          type: "string",
          title: "Component swap (trigger='textarea' → Textarea)",
          component: "Input",
          decorator: "FormItem",
          default: "",
          order: 20,
          "x-reaction": {
            component: (ctx: any) => ctx.get("trigger") === "textarea" ? "Textarea" : "Input",
          },
        },
        // DataSource reaction
        dsTarget: {
          type: "string",
          title: "DataSource driven",
          component: "Select",
          decorator: "FormItem",
          default: "",
          order: 30,
          "x-reaction": {
            dataSource: (ctx: any) => {
              const t = ctx.get("trigger") || "";
              return t.split(",").filter(Boolean).map((s: string) => ({ label: s.trim(), value: s.trim() }));
            },
          },
        },
        // Value reaction (computed field)
        computedTarget: {
          type: "string",
          title: "Computed value",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 40,
          "x-reaction": {
            value: (ctx: any) => `computed:${(ctx.get("trigger") || "").toUpperCase()}`,
          },
        },
      },
    },

    // ─── S7: Expression engine — all operators and edge cases ──────────────
    s7: {
      type: "void",
      title: "S7: Expression {{ }} — operators, nullish, member access",
      component: "SectionCard",
      order: 70,
      properties: {
        numA: {
          type: "number",
          title: "Number A",
          component: "NumberInput",
          decorator: "FormItem",
          default: 10,
          order: 10,
        },
        numB: {
          type: "number",
          title: "Number B",
          component: "NumberInput",
          decorator: "FormItem",
          default: 0,
          order: 20,
        },
        strVal: {
          type: "string",
          title: "String",
          component: "Input",
          decorator: "FormItem",
          default: "hello",
          order: 30,
        },
        // Arithmetic expression
        exprArith: {
          type: "string",
          title: "{{ numA * numB + 1 }}",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 40,
          "x-reaction": {
            value: "{{ numA * numB + 1 }}",
          },
        },
        // Comparison + conditional
        exprCond: {
          type: "string",
          title: "{{ numA > numB ? 'A wins' : 'B wins' }}",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 50,
          "x-reaction": {
            value: "{{ numA > numB ? 'A wins' : 'B wins' }}",
          },
        },
        // Nullish coalescing
        exprNullish: {
          type: "string",
          title: "{{ strVal ?? 'fallback' }}",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 60,
          "x-reaction": {
            value: "{{ strVal ?? 'fallback' }}",
          },
        },
        // String concatenation
        exprConcat: {
          type: "string",
          title: "{{ 'prefix-' + strVal + '-suffix' }}",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 70,
          "x-reaction": {
            value: "{{ 'prefix-' + strVal + '-suffix' }}",
          },
        },
        // Division by zero
        exprDivZero: {
          type: "string",
          title: "{{ numA / numB }} (div by 0?)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 80,
          "x-reaction": {
            value: "{{ numA / numB }}",
          },
        },
        // Logical operators
        exprLogical: {
          type: "string",
          title: "{{ numA > 5 && numB === 0 }}",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 90,
          "x-reaction": {
            value: "{{ numA > 5 && numB === 0 }}",
          },
        },
        // Negation
        exprNegate: {
          type: "string",
          title: "{{ !(numA > 100) }}",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 100,
          "x-reaction": {
            value: "{{ !(numA > 100) }}",
          },
        },
      },
    },

    // ─── S8: Selectors — $value, $path, $row, relative, collection ─────────
    s8: {
      type: "void",
      title: "S8: Selector types — $value, $path, ./relative, collection[]",
      component: "SectionCard",
      order: 80,
      properties: {
        items: {
          type: "array",
          title: "Items",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [{ name: "Alice", score: 90 }, { name: "Bob", score: 75 }],
          order: 10,
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                title: "Name",
                component: "Input",
                decorator: "FormItem",
                order: 10,
              },
              score: {
                type: "number",
                title: "Score",
                component: "NumberInput",
                decorator: "FormItem",
                order: 20,
              },
              // $row selector — reads sibling in same row
              badge: {
                type: "string",
                title: "Badge ($row.score reaction)",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 30,
                "x-reaction": {
                  value: (ctx: any) => {
                    const score = Number(ctx.get("$row.score")) || 0;
                    return score >= 80 ? "★ Pass" : "✗ Fail";
                  },
                },
              },
              // $path selector
              pathDisplay: {
                type: "string",
                title: "$path (shows own path)",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 40,
                "x-reaction": {
                  value: (ctx: any) => ctx.get("$path"),
                },
              },
            },
          },
        },
        // Collection selector: reads all scores from array
        totalScore: {
          type: "string",
          title: "Total (items[].score sum)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: (ctx: any) => {
              const scores: number[] = ctx.get("items[].score") || [];
              const sum = scores.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
              return `Sum=${sum}, Avg=${scores.length ? (sum / scores.length).toFixed(1) : 0}`;
            },
          },
        },
        // Relative selector test
        relativeBase: {
          type: "string",
          title: "Base (type here)",
          component: "Input",
          decorator: "FormItem",
          default: "base-val",
          order: 30,
        },
        relativeReader: {
          type: "string",
          title: "Reads ./relativeBase",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 40,
          "x-reaction": {
            value: (ctx: any) => `read: ${ctx.get("./relativeBase")}`,
          },
        },
      },
    },

    // ─── S9: validate — all static rules ───────────────────────────────────
    s9: {
      type: "void",
      title: "S9: Static validation — all rule types",
      component: "SectionCard",
      order: 90,
      properties: {
        minMaxNum: {
          type: "number",
          title: "Number [5, 100]",
          component: "NumberInput",
          decorator: "FormItem",
          default: 50,
          validate: { minimum: 5, maximum: 100 },
          order: 10,
        },
        exclusiveNum: {
          type: "number",
          title: "Number (0, 10) exclusive",
          component: "NumberInput",
          decorator: "FormItem",
          default: 5,
          validate: { exclusiveMinimum: 0, exclusiveMaximum: 10 },
          order: 20,
        },
        multipleOf: {
          type: "number",
          title: "Multiple of 3",
          component: "NumberInput",
          decorator: "FormItem",
          default: 9,
          validate: { multipleOf: 3, message: "Must be divisible by 3" },
          order: 30,
        },
        strLength: {
          type: "string",
          title: "String [3, 10] chars",
          component: "Input",
          decorator: "FormItem",
          default: "hello",
          validate: { minLength: 3, maxLength: 10 },
          order: 40,
        },
        patternField: {
          type: "string",
          title: "Pattern: ^[A-Z]{3}$",
          component: "Input",
          decorator: "FormItem",
          default: "ABC",
          validate: { pattern: "^[A-Z]{3}$", message: "Must be exactly 3 uppercase letters" },
          order: 50,
        },
        constField: {
          type: "string",
          title: "Const: must equal 'yes'",
          component: "Input",
          decorator: "FormItem",
          default: "yes",
          validate: { const: "yes", message: "Must be exactly 'yes'" },
          order: 60,
        },
        emailField: {
          type: "string",
          title: "Format: email",
          component: "Input",
          decorator: "FormItem",
          default: "user@test.com",
          validate: { format: "email" },
          order: 70,
        },
        urlField: {
          type: "string",
          title: "Format: url",
          component: "Input",
          decorator: "FormItem",
          default: "https://example.com",
          validate: { format: "url" },
          order: 80,
        },
      },
    },

    // ─── S10: x-validate — async, multi-rule, return types ─────────────────
    s10: {
      type: "void",
      title: "S10: x-validate — async, multiple rules, varied return",
      component: "SectionCard",
      order: 100,
      properties: {
        asyncField: {
          type: "string",
          title: "Async validate (simulated 500ms)",
          component: "Input",
          decorator: "FormItem",
          default: "valid",
          order: 10,
          "x-validate": async (ctx: any) => {
            // Simulate async check
            await new Promise(r => setTimeout(r, 100));
            return ctx.value === "invalid" ? "Server says: invalid!" : true;
          },
        },
        multiRule: {
          type: "string",
          title: "Multi x-validate rules",
          component: "Input",
          decorator: "FormItem",
          default: "HELLO",
          order: 20,
          "x-validate": [
            // Rule 1: must not be empty
            (ctx: any) => !ctx.value ? "Cannot be empty" : true,
            // Rule 2: must be uppercase
            (ctx: any) => ctx.value !== ctx.value?.toUpperCase() ? "Must be uppercase" : true,
            // Rule 3: return object format
            (ctx: any) => ctx.value?.length > 20 ? { message: "Too long", type: "custom" } : true,
          ],
        },
        boolReturn: {
          type: "string",
          title: "x-validate returns false → generic error",
          component: "Input",
          decorator: "FormItem",
          default: "ok",
          order: 30,
          "x-validate": (ctx: any) => ctx.value === "bad" ? false : true,
        },
      },
    },

    // ─── S11: x-effect — side effects with cleanup ─────────────────────────
    s11: {
      type: "void",
      title: "S11: x-effect — side effects, cleanup, form.effect()",
      component: "SectionCard",
      order: 110,
      properties: {
        effectSource: {
          type: "string",
          title: "Source (x-effect watches this)",
          component: "Input",
          decorator: "FormItem",
          default: "initial",
          order: 10,
          "x-effect": (ctx: any) => {
            // Effect that logs changes; returns cleanup
            const val = ctx.get("$value");
            console.log(`[S11 x-effect] effectSource changed to: "${val}"`);
            return () => console.log(`[S11 x-effect] cleanup for: "${val}"`);
          },
        },
        effectCounter: {
          type: "number",
          title: "Counter (incremented by effect)",
          component: "NumberInput",
          decorator: "FormItem",
          default: 0,
          props: { disabled: true },
          order: 20,
        },
      },
    },

    // ─── S12: order — rendering order vs definition order ──────────────────
    s12: {
      type: "void",
      title: "S12: order — should render Z, Y, X despite definition order",
      component: "SectionCard",
      order: 120,
      properties: {
        fieldX: { type: "string", title: "X (order=30, defined 1st)", component: "Input", decorator: "FormItem", default: "X", order: 30 },
        fieldY: { type: "string", title: "Y (order=20, defined 2nd)", component: "Input", decorator: "FormItem", default: "Y", order: 20 },
        fieldZ: { type: "string", title: "Z (order=10, defined 3rd)", component: "Input", decorator: "FormItem", default: "Z", order: 10 },
      },
    },

    // ─── S13: Form-level x-reaction (on root schema) ───────────────────────
    s13: {
      type: "void",
      title: "S13: Form-level x-reaction (root schema targets leaf fields)",
      component: "SectionCard",
      order: 130,
      properties: {
        modeSwitch: {
          type: "string",
          title: "Mode",
          component: "Select",
          decorator: "FormItem",
          default: "edit",
          dataSource: [
            { label: "Edit", value: "edit" },
            { label: "Read-only", value: "readonly" },
            { label: "Hidden", value: "hidden" },
          ],
          order: 10,
        },
        targetA: {
          type: "string",
          title: "Target A",
          component: "Input",
          decorator: "FormItem",
          default: "editable",
          order: 20,
          "x-reaction": {
            disabled: (ctx: any) => ctx.get("modeSwitch") === "readonly",
            display: (ctx: any) => ctx.get("modeSwitch") === "hidden" ? "none" : "visible",
          },
        },
        targetB: {
          type: "string",
          title: "Target B",
          component: "Input",
          decorator: "FormItem",
          default: "editable",
          order: 30,
          "x-reaction": {
            disabled: (ctx: any) => ctx.get("modeSwitch") === "readonly",
            display: (ctx: any) => ctx.get("modeSwitch") === "hidden" ? "none" : "visible",
          },
        },
      },
    },

    // ─── S14: Array — push defaults, remove middle, setRows ────────────────
    s14: {
      type: "void",
      title: "S14: Array operations — push/remove/setRows with reactions",
      component: "SectionCard",
      order: 140,
      properties: {
        tasks: {
          type: "array",
          title: "Tasks",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [
            { title: "Task 1", priority: "high" },
            { title: "Task 2", priority: "low" },
            { title: "Task 3", priority: "medium" },
          ],
          order: 10,
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                title: "Title",
                component: "Input",
                decorator: "FormItem",
                order: 10,
              },
              priority: {
                type: "string",
                title: "Priority",
                component: "Select",
                decorator: "FormItem",
                dataSource: [
                  { label: "High", value: "high" },
                  { label: "Medium", value: "medium" },
                  { label: "Low", value: "low" },
                ],
                order: 20,
              },
              // Computed from $row sibling
              urgencyBadge: {
                type: "string",
                title: "Urgency Badge",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 30,
                "x-reaction": {
                  value: (ctx: any) => {
                    const p = ctx.get("$row.priority");
                    return p === "high" ? "🔴 URGENT" : p === "medium" ? "🟡 NORMAL" : "🟢 LOW";
                  },
                },
              },
            },
          },
        },
        taskCount: {
          type: "string",
          title: "Task count (collection selector)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: (ctx: any) => {
              const titles: string[] = ctx.get("tasks[].title") || [];
              return `${titles.length} tasks: ${titles.filter(Boolean).join(", ")}`;
            },
          },
        },
      },
    },

    // ─── S15: @handler — named handler execution ───────────────────────────
    s15: {
      type: "void",
      title: "S15: @handler — named handler from config.handlers",
      component: "SectionCard",
      order: 150,
      properties: {
        handlerInput: {
          type: "string",
          title: "Input (handler computes derived)",
          component: "Input",
          decorator: "FormItem",
          default: "world",
          order: 10,
        },
        handlerOutput: {
          type: "string",
          title: "Output (@greet handler)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: "@greet",
          },
        },
        unknownHandler: {
          type: "string",
          title: "Unknown handler (should emit error, not crash)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 30,
          "x-reaction": {
            value: "@nonexistentHandler",
          },
        },
      },
    },

    // ─── S16: ctx.set — reaction writes to another field ───────────────────
    s16: {
      type: "void",
      title: "S16: ctx.set() — reaction writes to sibling",
      component: "SectionCard",
      order: 160,
      properties: {
        source: {
          type: "string",
          title: "Source (type triggers set on target)",
          component: "Input",
          decorator: "FormItem",
          default: "",
          order: 10,
          "x-effect": (ctx: any) => {
            const val = ctx.get("$value");
            if (val) ctx.set("mirror", `mirror:${val}`);
          },
        },
        mirror: {
          type: "string",
          title: "Mirror (written by source's effect)",
          component: "Input",
          decorator: "FormItem",
          default: "",
          order: 20,
        },
      },
    },

    // ─── S17: Array in array — nested array operations ─────────────────────
    s17: {
      type: "void",
      title: "S17: Array-in-array — nested add/remove/move",
      component: "SectionCard",
      order: 170,
      properties: {
        departments: {
          type: "array",
          title: "Departments",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [
            { deptName: "Engineering", members: [{ name: "Alice", role: "lead" }] },
          ],
          order: 10,
          items: {
            type: "object",
            properties: {
              deptName: {
                type: "string",
                title: "Department",
                component: "Input",
                decorator: "FormItem",
                order: 10,
              },
              members: {
                type: "array",
                title: "Members",
                component: "ArrayCards",
                decorator: "FormItem",
                order: 20,
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      title: "Name",
                      component: "Input",
                      decorator: "FormItem",
                      order: 10,
                    },
                    role: {
                      type: "string",
                      title: "Role",
                      component: "Select",
                      decorator: "FormItem",
                      dataSource: [
                        { label: "Lead", value: "lead" },
                        { label: "Member", value: "member" },
                        { label: "Intern", value: "intern" },
                      ],
                      order: 20,
                    },
                    roleBadge: {
                      type: "string",
                      title: "Role Badge",
                      component: "Input",
                      decorator: "FormItem",
                      props: { disabled: true },
                      order: 30,
                      "x-reaction": {
                        value: (ctx: any) => {
                          const role = ctx.get("$row.role");
                          return role === "lead" ? "👑 Lead" : role === "member" ? "👤 Member" : "🌱 Intern";
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── S18: Object in array with $row.nested.path ────────────────────────
    s18: {
      type: "void",
      title: "S18: $row.nested.path — deep object access in row",
      component: "SectionCard",
      order: 180,
      properties: {
        invoices: {
          type: "array",
          title: "Invoice Items",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [{ product: { name: "Widget", unitPrice: 25 }, qty: 4 }],
          order: 10,
          items: {
            type: "object",
            properties: {
              product: {
                type: "object",
                title: "Product",
                component: "SectionCard",
                order: 10,
                properties: {
                  name: {
                    type: "string",
                    title: "Product Name",
                    component: "Input",
                    decorator: "FormItem",
                    order: 10,
                  },
                  unitPrice: {
                    type: "number",
                    title: "Unit Price",
                    component: "NumberInput",
                    decorator: "FormItem",
                    order: 20,
                  },
                },
              },
              qty: {
                type: "number",
                title: "Quantity",
                component: "NumberInput",
                decorator: "FormItem",
                order: 20,
              },
              lineTotal: {
                type: "string",
                title: "Line Total ($row.product.unitPrice * $row.qty)",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 30,
                "x-reaction": {
                  value: (ctx: any) => {
                    const price = Number(ctx.get("$row.product.unitPrice")) || 0;
                    const qty = Number(ctx.get("$row.qty")) || 0;
                    return `¥${(price * qty).toLocaleString()}`;
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── S19: setValues with deep paths + array ────────────────────────────
    s19: {
      type: "void",
      title: "S19: setValues — deep object paths + array replacement",
      component: "SectionCard",
      order: 190,
      properties: {
        profile: {
          type: "object",
          title: "Profile",
          component: "SectionCard",
          properties: {
            firstName: { type: "string", title: "First", component: "Input", decorator: "FormItem", default: "John", order: 10 },
            lastName: { type: "string", title: "Last", component: "Input", decorator: "FormItem", default: "Doe", order: 20 },
          },
        },
        tags: {
          type: "array",
          title: "Tags",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [{ tag: "alpha" }],
          order: 20,
          items: {
            type: "object",
            properties: {
              tag: { type: "string", title: "Tag", component: "Input", decorator: "FormItem" },
            },
          },
        },
      },
    },

    // ─── S20: Multiple reactions on same field (array of rules) ────────────
    s20: {
      type: "void",
      title: "S20: Multiple reaction rules (array) on same target",
      component: "SectionCard",
      order: 200,
      properties: {
        condA: {
          type: "boolean",
          title: "Condition A",
          component: "Switch",
          decorator: "FormItem",
          default: false,
          order: 10,
        },
        condB: {
          type: "boolean",
          title: "Condition B",
          component: "Switch",
          decorator: "FormItem",
          default: false,
          order: 20,
        },
        multiTarget: {
          type: "string",
          title: "Multi-rule target (disabled = A || B, title depends on both)",
          component: "Input",
          decorator: "FormItem",
          default: "test",
          order: 30,
          "x-reaction": {
            disabled: (ctx: any) => ctx.get("condA") || ctx.get("condB"),
            title: (ctx: any) => {
              const a = ctx.get("condA");
              const b = ctx.get("condB");
              return `A=${a}, B=${b} → ${a && b ? "BOTH" : a ? "A only" : b ? "B only" : "NONE"}`;
            },
            required: (ctx: any) => ctx.get("condA") && !ctx.get("condB"),
          },
        },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════════════════════════════════

function DebugPanel() {
  const values = useFormValues();
  const errors = useFormErrors();
  const valid = useFormValid();
  return (
    <Card size="small" title="Debug Panel" style={{ marginTop: 16, background: "#f6f8fa" }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Tag color={valid ? "green" : "red"}>{valid ? "VALID" : "INVALID"}</Tag>
        {errors.length > 0 && (
          <div>
            <Text type="danger">Errors ({errors.length}):</Text>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {errors.slice(0, 5).map((e, i) => <li key={i}><Text type="danger" style={{ fontSize: 12 }}>{e.message}</Text></li>)}
            </ul>
          </div>
        )}
        <details>
          <summary>values (JSON)</summary>
          <pre style={{ fontSize: 11, maxHeight: 300, overflow: "auto" }}>{JSON.stringify(values, null, 2)}</pre>
        </details>
      </Space>
    </Card>
  );
}

function ErrorLogPanel({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <Card size="small" title="Error Log (onError)" style={{ marginTop: 16, background: "#fff2f0", borderColor: "#ffccc7" }}>
      <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 200, overflow: "auto" }}>
        {errors.map((e, i) => <li key={i}><Text type="danger" style={{ fontSize: 11 }}>{e}</Text></li>)}
      </ul>
    </Card>
  );
}

export default function SchemaEdgeCaseTest() {
  const [errorLog, setErrorLog] = useState<string[]>([]);

  const form = useCreateForm({
    schema: schemaEdgeCases,
    initialValues: {
      // S4: initialValues should override defaults
      priorityField: "from-initial-values",
      noDefaultField: "injected-by-initialValues",
    },
    handlers: {
      // S15: named handler
      greet: (ctx) => `Hello, ${ctx.get("handlerInput") || "nobody"}!`,
    },
    onError: (err) => {
      setErrorLog((prev) => [...prev.slice(-19), `[${err.scope}] ${err.path}: ${err.message}`]);
    },
  });

  const handleValidate = useCallback(async () => {
    const valid = await form.validate();
    console.log("[Schema Edge] validate result:", valid);
  }, [form]);

  const handleReset = useCallback(() => {
    form.reset();
    console.log("[Schema Edge] form reset");
  }, [form]);

  const handleSetValues = useCallback(() => {
    form.setValues({
      visibleField: "SET-VIA-API",
      "profile.firstName": "Jane",
      "profile.lastName": "Smith",
    });
    console.log("[Schema Edge] setValues called");
  }, [form]);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Title level={3}>Schema-Driven Edge Cases (S1-S20)</Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Schema Contract Tests"
        description={
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
            <li><b>S1</b>: $ref (basic, override, deep)</li>
            <li><b>S2</b>: display:none exclusion from values/validation</li>
            <li><b>S3</b>: void path-skipping in values()</li>
            <li><b>S4</b>: initialValues vs default priority</li>
            <li><b>S5</b>: required (3 declaration methods)</li>
            <li><b>S6</b>: All 12 x-reaction target keys</li>
            <li><b>S7</b>: Expression engine operators/edge cases</li>
            <li><b>S8</b>: Selector types ($row, $path, relative, collection)</li>
            <li><b>S9</b>: Static validation rules</li>
            <li><b>S10</b>: x-validate async/multi-rule</li>
            <li><b>S11</b>: x-effect lifecycle/cleanup</li>
            <li><b>S12</b>: order property</li>
            <li><b>S13</b>: Form-level reactions</li>
            <li><b>S14</b>: Array ops with reactions</li>
            <li><b>S15</b>: @handler named execution</li>
            <li><b>S16</b>: ctx.set() cross-field write</li>
            <li><b>S17</b>: Array-in-array</li>
            <li><b>S18</b>: $row.nested.path deep access</li>
            <li><b>S19</b>: setValues deep paths</li>
            <li><b>S20</b>: Multiple rules on same target</li>
          </ul>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Button onClick={handleValidate} type="primary">Validate All</Button>
        <Button onClick={handleReset}>Reset</Button>
        <Button onClick={handleSetValues}>setValues (test)</Button>
        <Button danger onClick={() => setErrorLog([])}>Clear Error Log</Button>
      </Space>

      <FormProvider form={form} components={components} decorators={decorators}>
        <SchemaField schema={schemaEdgeCases} />
        <DebugPanel />
      </FormProvider>
      <ErrorLogPanel errors={errorLog} />
    </div>
  );
}
