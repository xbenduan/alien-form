import React from "react";
import { Card, Button, Divider, Typography } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
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

const { Title, Paragraph } = Typography;

const schemaEdgeCases: IFormSchema = {
  type: "object",
  definitions: {
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
    s1: {
      type: "void",
      title: "S1: $ref — basic / override / deep nesting",
      component: "SectionCard",
      order: 10,
      properties: {
        emailBasic: { $ref: "#/definitions/emailField", order: 10 },
        emailOverride: {
          $ref: "#/definitions/emailField",
          title: "Work Email (overridden title)",
          default: "user@company.com",
          order: 20,
        },
        address: { $ref: "#/definitions/addressBlock", order: 30 },
      },
    },
    s2: {
      type: "void",
      title: "S2: Validation — multiple rules",
      component: "SectionCard",
      order: 20,
      properties: {
        username: {
          type: "string",
          title: "Username (3-20 chars, alphanumeric)",
          component: "Input",
          decorator: "FormItem",
          required: true,
          validate: {
            minLength: 3,
            maxLength: 20,
            pattern: "^[a-zA-Z0-9_]+$",
            message: "3-20 alphanumeric characters or underscore",
          },
          order: 10,
        },
        age: {
          type: "number",
          title: "Age (18-120)",
          component: "NumberInput",
          decorator: "FormItem",
          validate: { minimum: 18, maximum: 120, message: "Age must be 18-120" },
          order: 20,
        },
      },
    },
    s3: {
      type: "void",
      title: "S3: Nested array with items schema",
      component: "SectionCard",
      order: 30,
      properties: {
        tags: {
          type: "array",
          title: "Tags (array of strings)",
          component: "TagsInput",
          decorator: "FormItem",
          default: ["alpha", "beta"],
          order: 10,
        },
        contacts: {
          type: "array",
          title: "Contacts (array of objects)",
          component: "ArrayCards",
          decorator: "FormItem",
          props: { addText: "+ Add Contact" },
          order: 20,
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                title: "Name",
                component: "Input",
                decorator: "FormItem",
                required: true,
                order: 10,
              },
              phone: {
                type: "string",
                title: "Phone",
                component: "Input",
                decorator: "FormItem",
                validate: { pattern: "^[0-9+\\-() ]+$", message: "Invalid phone" },
                order: 20,
              },
            },
          },
        },
      },
    },
    s4: {
      type: "void",
      title: "S4: Default values — various types",
      component: "SectionCard",
      order: 40,
      properties: {
        strDefault: {
          type: "string",
          title: "String (default='hello')",
          component: "Input",
          decorator: "FormItem",
          default: "hello",
          order: 10,
        },
        numDefault: {
          type: "number",
          title: "Number (default=42)",
          component: "NumberInput",
          decorator: "FormItem",
          default: 42,
          order: 20,
        },
        boolDefault: {
          type: "boolean",
          title: "Boolean (default=true)",
          component: "Switch",
          decorator: "FormItem",
          default: true,
          order: 30,
        },
        selectDefault: {
          type: "string",
          title: "Select (default='b')",
          component: "Select",
          decorator: "FormItem",
          default: "b",
          dataSource: [
            { label: "Option A", value: "a" },
            { label: "Option B", value: "b" },
            { label: "Option C", value: "c" },
          ],
          order: 40,
        },
      },
    },
    s5: {
      type: "void",
      title: "S5: Display modes — visible / hidden / none",
      component: "SectionCard",
      order: 50,
      properties: {
        modeSelect: {
          type: "string",
          title: "Display mode selector",
          component: "Select",
          decorator: "FormItem",
          default: "visible",
          dataSource: [
            { label: "Visible", value: "visible" },
            { label: "Hidden (occupies space)", value: "hidden" },
            { label: "None (removed)", value: "none" },
          ],
          order: 10,
        },
        targetField: {
          type: "string",
          title: "Target field",
          component: "Input",
          decorator: "FormItem",
          default: "I am the target",
          order: 20,
          "x-reaction": {
            display: "{{ modeSelect }}",
          },
        },
      },
    },
  },
};

const components = {
  Input, Textarea, NumberInput, Select, Switch, Radio,
  CheckboxGroup, TagsInput, SectionCard, ArrayCards,
};
const decorators = { FormItem };

export default function SchemaEdgeCaseTest() {
  const form = useCreateForm({ schema: schemaEdgeCases });

  return (
    <Card>
      <Title level={4}>Schema Edge Case Tests</Title>
      <Paragraph type="secondary">
        Tests schema-driven features: $ref resolution with overrides, validation rules,
        nested arrays, default values, and display mode control.
      </Paragraph>
      <Divider />
      <FormProvider form={form} components={components} decorators={decorators}>
        <SchemaField />
      </FormProvider>
      <Divider />
      <Button onClick={() => form.reset()}>Reset</Button>
    </Card>
  );
}
