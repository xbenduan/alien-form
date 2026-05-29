import React, { useCallback } from "react";
import { Card, Button, Space, Divider, Typography, Tag } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useForm,
  useFieldValue,
  useFieldDisplay,
  useFieldDisabled,
  useFormValues,
  useSignalValue,
  type IFormSchema,
  type FormConfig,
} from "@alien-form/react";
import { Input, Select, FormItem, SectionCard, ArrayCards } from "@/adapters";

const { Title, Text, Paragraph } = Typography;

// ═══════════════════════════════════════════════════════════════════════════════
// Test Schema — covers all x-reaction cases with dependencies
// ═══════════════════════════════════════════════════════════════════════════════

const reactionTestSchema: IFormSchema = {
  type: "object",
  properties: {
    // ─── Case 1: type:"match" + dependencies → display toggle ───────────────
    case1: {
      type: "void",
      title: "Case 1: match + dependencies → display",
      component: "SectionCard",
      order: 10,
      properties: {
        trigger1: {
          type: "string",
          title: "触发字段 (trigger1)",
          component: "Select",
          decorator: "FormItem",
          default: "show",
          dataSource: [
            { label: "显示 target1", value: "show" },
            { label: "隐藏 target1", value: "hide" },
            { label: "移除 target1", value: "none" },
          ],
          props: { placeholder: "选择以控制 target1 的 display" },
          order: 10,
        },
        target1: {
          type: "string",
          title: "目标字段 (target1)",
          component: "Input",
          decorator: "FormItem",
          default: "我应该根据 trigger1 显示/隐藏",
          order: 20,
          "x-reaction": {
            display: "{{ trigger1 === 'hide' ? 'hidden' : trigger1 === 'none' ? 'none' : 'visible' }}",
          },
        },
      },
    },

    // ─── Case 2: type:"expression" + dependencies → value ───────────────────
    case2: {
      type: "void",
      title: "Case 2: expression + dependencies → value",
      component: "SectionCard",
      order: 20,
      properties: {
        firstName: {
          type: "string",
          title: "名 (firstName)",
          component: "Input",
          decorator: "FormItem",
          default: "张",
          props: { placeholder: "输入名" },
          order: 10,
        },
        lastName: {
          type: "string",
          title: "姓 (lastName)",
          component: "Input",
          decorator: "FormItem",
          default: "三",
          props: { placeholder: "输入姓" },
          order: 20,
        },
        fullName: {
          type: "string",
          title: "全名 (fullName) — 自动拼接",
          component: "Input",
          decorator: "FormItem",
          props: { placeholder: "由 reaction 自动计算", disabled: true },
          order: 30,
          "x-reaction": {
            value: "{{ firstName + lastName }}",
          },
        },
      },
    },

    // ─── Case 3: type:"computed" + handler + dependencies ───────────────────
    case3: {
      type: "void",
      title: "Case 3: computed + handler + dependencies → disabled",
      component: "SectionCard",
      order: 30,
      properties: {
        role: {
          type: "string",
          title: "角色 (role)",
          component: "Select",
          decorator: "FormItem",
          default: "viewer",
          dataSource: [
            { label: "管理员", value: "admin" },
            { label: "编辑者", value: "editor" },
            { label: "查看者", value: "viewer" },
          ],
          order: 10,
        },
        secretField: {
          type: "string",
          title: "受限字段 (secretField)",
          component: "Input",
          decorator: "FormItem",
          default: "只有 admin 可编辑",
          order: 20,
          "x-reaction": {
            disabled: "@isNotAdmin",
          },
        },
      },
    },

    // ─── Case 4: Multiple dependencies (Record form) → required ─────────────
    case4: {
      type: "void",
      title: "Case 4: expression + multiple deps (Record) → required",
      component: "SectionCard",
      order: 40,
      properties: {
        enableA: {
          type: "string",
          title: "开关A (enableA)",
          component: "Select",
          decorator: "FormItem",
          default: "no",
          dataSource: [
            { label: "是", value: "yes" },
            { label: "否", value: "no" },
          ],
          order: 10,
        },
        enableB: {
          type: "string",
          title: "开关B (enableB)",
          component: "Select",
          decorator: "FormItem",
          default: "no",
          dataSource: [
            { label: "是", value: "yes" },
            { label: "否", value: "no" },
          ],
          order: 20,
        },
        conditionalField: {
          type: "string",
          title: "条件必填字段 — A和B都为'是'时必填",
          component: "Input",
          decorator: "FormItem",
          props: { placeholder: "当 enableA=yes AND enableB=yes 时必填" },
          order: 30,
          "x-reaction": {
            required: "{{ enableA === 'yes' && enableB === 'yes' }}",
          },
        },
      },
    },

    // ─── Case 5: type:"match" + dependencies → dataSource ──────────────────
    case5: {
      type: "void",
      title: "Case 5: match + dependencies → dataSource",
      component: "SectionCard",
      order: 50,
      properties: {
        country: {
          type: "string",
          title: "国家 (country)",
          component: "Select",
          decorator: "FormItem",
          default: "cn",
          dataSource: [
            { label: "中国", value: "cn" },
            { label: "美国", value: "us" },
            { label: "日本", value: "jp" },
          ],
          order: 10,
        },
        city: {
          type: "string",
          title: "城市 (city) — 联动选项",
          component: "Select",
          decorator: "FormItem",
          props: { placeholder: "根据国家显示不同城市" },
          order: 20,
          "x-reaction": {
            dataSource: "@cityOptions",
            value: undefined,
          },
        },
      },
    },

    // ─── Case 6: expression + dependencies → title (dynamic label) ──────────
    case6: {
      type: "void",
      title: "Case 6: expression + dependencies → title",
      component: "SectionCard",
      order: 60,
      properties: {
        count: {
          type: "string",
          title: "数量 (count)",
          component: "Select",
          decorator: "FormItem",
          default: "1",
          dataSource: [
            { label: "1", value: "1" },
            { label: "5", value: "5" },
            { label: "10", value: "10" },
            { label: "100", value: "100" },
          ],
          order: 10,
        },
        items: {
          type: "string",
          title: "项目",
          component: "Input",
          decorator: "FormItem",
          props: { placeholder: "title 会根据 count 动态变化" },
          order: 20,
          "x-reaction": {
            title: "{{ '项目 (共 ' + count + ' 个)' }}",
          },
        },
      },
    },

    // ─── Case 7: Array items with x-reaction (push后子字段reaction是否工作) ──
    case7: {
      type: "void",
      title: "Case 7: Array items 内部的 x-reaction",
      component: "SectionCard",
      order: 70,
      properties: {
        rows: {
          type: "array",
          title: "动态行 (push后观察行内联动)",
          component: "ArrayCards",
          decorator: "FormItem",
          props: { addText: "+ 添加行" },
          order: 10,
          items: {
            type: "object",
            properties: {
              rowType: {
                type: "string",
                title: "行类型",
                component: "Select",
                decorator: "FormItem",
                default: "text",
                dataSource: [
                  { label: "文本", value: "text" },
                  { label: "数字", value: "number" },
                  { label: "隐藏详情", value: "hidden" },
                ],
                order: 10,
              },
              rowDetail: {
                type: "string",
                title: "行详情",
                component: "Input",
                decorator: "FormItem",
                props: { placeholder: "根据 rowType 控制显隐" },
                order: 20,
                "x-reaction": {
                  display: "{{ rowType === 'hidden' ? 'none' : 'visible' }}",
                  title: "{{ '详情 (' + rowType + ' 模式)' }}",
                },
              },
            },
          },
        },
      },
    },
  },
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

const reactionHandlers: FormConfig["handlers"] = {
  isNotAdmin: (ctx) => {
    const role = ctx.get("role");
    console.log("[handler:isNotAdmin] role =", role, "→ disabled =", role !== "admin");
    return role !== "admin";
  },
  cityOptions: (ctx) => {
    const country = ctx.get("country");
    if (country === "cn") return [
      { label: "北京", value: "beijing" },
      { label: "上海", value: "shanghai" },
      { label: "深圳", value: "shenzhen" },
    ];
    if (country === "us") return [
      { label: "New York", value: "nyc" },
      { label: "San Francisco", value: "sf" },
      { label: "Los Angeles", value: "la" },
    ];
    if (country === "jp") return [
      { label: "东京", value: "tokyo" },
      { label: "大阪", value: "osaka" },
      { label: "京都", value: "kyoto" },
    ];
    return [];
  },
};

// ─── Components ──────────────────────────────────────────────────────────────

const components = { Input, Select, SectionCard, ArrayCards };
const decorators = { FormItem };

// ─── Debug Panel ─────────────────────────────────────────────────────────────

const DebugPanel: React.FC = () => {
  const form = useForm();
  const values = useFormValues();

  // Read specific fields to show reaction results
  const target1Display = useFieldDisplay("target1");
  const fullNameValue = useFieldValue("fullName");
  const secretDisabled = useFieldDisabled("secretField");

  // For fields that may not exist, use form.field() + useSignalValue with fallback
  const conditionalField = form.field("conditionalField");
  const conditionalRequired = useSignalValue(conditionalField?.required ?? falseSignalLocal);

  const cityField = form.field("city");
  const cityDataSource = useSignalValue(cityField?.dataSource ?? emptyArraySignalLocal);

  const itemsField = form.field("items");
  const itemsTitle = useSignalValue(itemsField?.title ?? emptyStringSignalLocal);

  return (
    <Card title="Reaction Debug Panel" size="small" style={{ marginTop: 16, background: "#f6f8fa" }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          <Tag color="blue">Case 1</Tag>
          <Text>target1.display = <Text code>{target1Display}</Text></Text>
        </div>
        <div>
          <Tag color="green">Case 2</Tag>
          <Text>fullName.value = <Text code>{JSON.stringify(fullNameValue)}</Text></Text>
        </div>
        <div>
          <Tag color="orange">Case 3</Tag>
          <Text>secretField.disabled = <Text code>{String(secretDisabled)}</Text></Text>
        </div>
        <div>
          <Tag color="red">Case 4</Tag>
          <Text>conditionalField.required = <Text code>{String(conditionalRequired)}</Text></Text>
        </div>
        <div>
          <Tag color="purple">Case 5</Tag>
          <Text>city.dataSource = <Text code>{JSON.stringify((cityDataSource as any[]).map((d: any) => d.value))}</Text></Text>
        </div>
        <div>
          <Tag color="cyan">Case 6</Tag>
          <Text>items.title = <Text code>{itemsTitle}</Text></Text>
        </div>
        <div>
          <Tag color="gold">Case 7</Tag>
          <Text>Array push 后行内 x-reaction — 切换 rowType 观察 rowDetail 显隐</Text>
        </div>
      </Space>
      <Divider style={{ margin: "12px 0" }} />
      <Paragraph style={{ fontSize: 12, color: "#666" }}>
        打开浏览器 Console 查看详细日志。每次 dependency 变化时应打印对应的 log。
      </Paragraph>
      <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto", background: "#fff", padding: 8, borderRadius: 4 }}>
        {JSON.stringify(values, null, 2)}
      </pre>
    </Card>
  );
};

// Local fallback signals for DebugPanel (fields always exist so these are just type safety)
import { signal as createSig } from "@alien-form/core";
const falseSignalLocal = createSig(false);
const emptyArraySignalLocal = createSig([] as any[]);
const emptyStringSignalLocal = createSig("");

// ─── Main Page ──────────────────────────────────────────────────────────────

export const ReactionTest: React.FC = () => {
  // Schema passed at creation time — no setSchema needed!
  const form = useCreateForm({
    schema: reactionTestSchema,
    handlers: reactionHandlers,
  });

  const handleReset = useCallback(() => {
    form.reset();
    console.log("[reaction-test] form.reset() called");
  }, [form]);

  return (
    <Card>
      <Title level={4}>x-reaction Dependencies 测试</Title>
      <Paragraph type="secondary">
        验证 x-reaction 中声明了 dependencies 的规则在依赖字段变化时是否正确重新执行。
        修改各 Case 的触发字段，观察目标字段是否联动更新。
      </Paragraph>
      <Divider />
      <FormProvider form={form} components={components} decorators={decorators}>
        <SchemaField />
        <DebugPanel />
      </FormProvider>
      <Divider />
      <Space>
        <Button onClick={handleReset}>重置表单</Button>
      </Space>
    </Card>
  );
};
