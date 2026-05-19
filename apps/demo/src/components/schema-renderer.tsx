import React, { useState, useMemo, useCallback } from "react";
import { createForm } from "@alien-form/core";
import { FormProvider, SchemaField } from "@alien-form/react";
import type { FormConfig } from "@alien-form/core";
import type { ComponentMap, DecoratorMap } from "@alien-form/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  DateInput,
  ItemInput,
  RadioGroup,
  Rating,
  FormItem,
  FormGrid,
  FormLayout,
  FormSection,
  ArrayCards,
  ArrayTable,
} from "@alien-form/ui";
import type { SchemaItem } from "../useSchema";

// --- Computed reaction handlers (for demo) ---

const categoryData: Record<string, Array<{ label: string; value: string }>> = {
  tech: [
    { label: "前端", value: "frontend" },
    { label: "后端", value: "backend" },
    { label: "运维", value: "devops" },
    { label: "AI/机器学习", value: "ai" },
  ],
  design: [
    { label: "UI 设计", value: "ui" },
    { label: "用户研究", value: "ux" },
    { label: "品牌设计", value: "brand" },
  ],
  business: [
    { label: "市场", value: "marketing" },
    { label: "销售", value: "sales" },
    { label: "战略", value: "strategy" },
  ],
};

const handlers: FormConfig["handlers"] = {
  fetchCountries: async () => {
    await new Promise((r) => setTimeout(r, 500));
    return [
      { label: "中国", value: "cn" },
      { label: "新加坡", value: "sg" },
      { label: "日本", value: "jp" },
      { label: "美国", value: "us" },
      { label: "英国", value: "uk" },
      { label: "德国", value: "de" },
    ];
  },
  fetchCategories: async () => {
    await new Promise((r) => setTimeout(r, 500));
    return [
      { label: "技术", value: "tech" },
      { label: "设计", value: "design" },
      { label: "业务", value: "business" },
    ];
  },
  fetchSubCategories: async ({ deps }) => {
    await new Promise((r) => setTimeout(r, 400));
    const cat = deps.category;
    if (!cat) return [];
    return categoryData[cat] || [];
  },
  normalizeCode: ({ value }) => String(value ?? "").trim().toUpperCase(),
  checkConfirmCode: async ({ value }) => {
    await new Promise((r) => setTimeout(r, 300));
    return String(value ?? "").trim().toUpperCase() === "OK"
      ? []
      : [{ message: "确认码必须是 OK", type: "x-validate" }];
  },
};

const components: ComponentMap = {
  Input: (props: any) => {
    const { value, onChange, loading, ...rest } = props;
    return (
      <Input
        value={value ?? ""}
        onChange={(e: any) => onChange(e.target.value)}
        {...rest}
      />
    );
  },
  Textarea: (props: any) => {
    const { value, onChange, loading, ...rest } = props;
    return (
      <Textarea
        value={value ?? ""}
        onChange={(e: any) => onChange(e.target.value)}
        {...rest}
      />
    );
  },
  Select: (props: any) => {
    const { loading, ...rest } = props;
    return (
      <div className="relative">
        <Select {...rest} />
        {loading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}
      </div>
    );
  },
  Checkbox,
  Switch,
  DateInput,
  ItemInput,
  RadioGroup,
  Rating,
  FormGrid,
  FormLayout,
  FormSection,
  ArrayCards,
  ArrayTable,
};

const decorators: DecoratorMap = {
  FormItem,
};

interface SchemaRendererProps {
  schema: SchemaItem;
}

export const SchemaRenderer: React.FC<SchemaRendererProps> = ({ schema }) => {
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useMemo(
    () =>
      createForm({
        handlers,
      }),
    [schema.id],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const values = await form.submit();
      setResult({ success: true, values, timestamp: new Date().toISOString() });
    } catch (err: any) {
      setResult({
        success: false,
        errors: err?.messages || [String(err)],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const handleReset = useCallback(() => {
    form.reset();
    setResult(null);
  }, [form]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{schema.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{schema.description}</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="form">
            <TabsList className="mb-4">
              <TabsTrigger value="form">表单预览</TabsTrigger>
              <TabsTrigger value="json">Schema 结构</TabsTrigger>
            </TabsList>
            <TabsContent value="form">
              <FormProvider
                form={form}
                components={components}
                decorators={decorators}
              >
                <SchemaField schema={schema.schema} />
              </FormProvider>
            </TabsContent>
            <TabsContent value="json">
              <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto max-h-[500px]">
                <code>{JSON.stringify(schema.schema, null, 2)}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex gap-2 border-t pt-4">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "提交"}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            重置
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              提交结果
              <span
                className={`inline-block h-2 w-2 rounded-full ${result.success ? "bg-green-500" : "bg-destructive"}`}
              />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{result.timestamp}</p>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto max-h-[300px]">
              <code>
                {result.success
                  ? JSON.stringify(result.values, null, 2)
                  : JSON.stringify(result.errors, null, 2)}
              </code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
