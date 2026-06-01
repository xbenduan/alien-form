import React, { useCallback } from "react";
import { Card, Button, Divider, Typography } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
} from "@alien-form/react";
import {
  Input,
  Select,
  Switch,
  FormItem,
  SectionCard,
  ArrayCards,
} from "@/adapters";

const { Title, Paragraph } = Typography;

const edgeCaseSchema: IFormSchema = {
  type: "object",
  properties: {
    e1: {
      type: "void",
      title: "E1: Self-referencing reaction (reads own value)",
      component: "SectionCard",
      order: 10,
      properties: {
        selfRef: {
          type: "string",
          title: "Self-ref field",
          component: "Input",
          decorator: "FormItem",
          default: "hello",
          order: 10,
          "x-reaction": {
            title: (ctx: any) => {
              const val = ctx.get("selfRef");
              return `Current: "${val || ""}" (len=${(val || "").length})`;
            },
          },
        },
      },
    },
    e2: {
      type: "void",
      title: "E2: Diamond dependency (A→B, A→C, B+C→D)",
      component: "SectionCard",
      order: 20,
      properties: {
        diamondA: {
          type: "string",
          title: "A (source)",
          component: "Select",
          decorator: "FormItem",
          default: "x",
          dataSource: [
            { label: "X", value: "x" },
            { label: "Y", value: "y" },
            { label: "Z", value: "z" },
          ],
          order: 10,
        },
        diamondB: {
          type: "string",
          title: "B (= A + '-B')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": { value: "{{ diamondA + '-B' }}" },
        },
        diamondC: {
          type: "string",
          title: "C (= A + '-C')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 30,
          "x-reaction": { value: "{{ diamondA + '-C' }}" },
        },
        diamondD: {
          type: "string",
          title: "D (= B + '|' + C)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 40,
          "x-reaction": { value: "{{ diamondB + '|' + diamondC }}" },
        },
      },
    },
    e3: {
      type: "void",
      title: "E3: Rapid display toggle + value preservation",
      component: "SectionCard",
      order: 30,
      properties: {
        toggleSwitch: {
          type: "boolean",
          title: "Quick toggle (click multiple times)",
          component: "Switch",
          decorator: "FormItem",
          default: true,
          order: 10,
        },
        toggleTarget: {
          type: "string",
          title: "Controlled field — value persists after hide/show",
          component: "Input",
          decorator: "FormItem",
          default: "My value should remain unchanged",
          order: 20,
          "x-reaction": {
            display: "{{ toggleSwitch ? 'visible' : 'none' }}",
          },
        },
      },
    },
    e4: {
      type: "void",
      title: "E4: 4-level chain reaction (A→B→C→D)",
      component: "SectionCard",
      order: 40,
      properties: {
        chainA: {
          type: "string",
          title: "Chain A (enter any value)",
          component: "Input",
          decorator: "FormItem",
          default: "start",
          order: 10,
        },
        chainB: {
          type: "string",
          title: "Chain B (= A + '→B')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": { value: "{{ chainA + '→B' }}" },
        },
        chainC: {
          type: "string",
          title: "Chain C (= B + '→C')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 30,
          "x-reaction": { value: "{{ chainB + '→C' }}" },
        },
        chainD: {
          type: "string",
          title: "Chain D (= C + '→D') — should equal 'start→B→C→D'",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 40,
          "x-reaction": { value: "{{ chainC + '→D' }}" },
        },
      },
    },
  },
};

const components = { Input, Select, Switch, SectionCard, ArrayCards };
const decorators = { FormItem };

export default function EdgeCaseTest() {
  const form = useCreateForm({ schema: edgeCaseSchema });

  return (
    <Card>
      <Title level={4}>Edge Case Tests</Title>
      <Paragraph type="secondary">
        Tests self-referencing reactions, diamond dependencies, rapid toggling, and 4-level chained reactions.
        Modify source fields and observe that targets update correctly without infinite loops.
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
