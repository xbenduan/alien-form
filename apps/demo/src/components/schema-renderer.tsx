import React, { useState, useMemo, useCallback } from "react";
import { createForm } from "@alien-form/core";
import { FormProvider, SchemaField } from "@alien-form/react";
import type { IForm } from "@alien-form/core";
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
  SchemaInput,
  SchemaTextarea,
  SchemaSelect,
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
import { schemaRendererHandlers } from "../mock/schema-renderer";
import {
  areSkuRowsEqual,
  buildCartesianSpecRows,
  createSkuDemoInitialValues,
  enforceSingleImageSpec,
  normalizeSpecs,
  type SkuDraft,
} from "../utils/sku-matrix";
import { SkuTable } from "./sku-table";
import { ImageInput } from "./image-input";

const SKU_MATRIX_DEMO_ID = "07-spec-sku-matrix";
const SKU_MATRIX_SPECS_PATH = "specs";
const SKU_MATRIX_SKUS_PATH = "skus";

function syncSkuMatrix(form: IForm, syncingState: { current: boolean }) {
  if (syncingState.current) return;

  const rawSpecs = form.getField(SKU_MATRIX_SPECS_PATH)?.value;
  const imageControlled = enforceSingleImageSpec(rawSpecs);

  if (imageControlled.changed) {
    syncingState.current = true;
    form.setValues({
      specs: imageControlled.specs,
    });
    syncingState.current = false;
    return;
  }

  const specs = normalizeSpecs(imageControlled.specs);
  const currentSkus = Array.isArray(form.getField(SKU_MATRIX_SKUS_PATH)?.value)
    ? (form.getField(SKU_MATRIX_SKUS_PATH)?.value as SkuDraft[])
    : [];
  const nextSkus = buildCartesianSpecRows(specs, currentSkus);

  if (areSkuRowsEqual(currentSkus, nextSkus)) return;

  syncingState.current = true;
  form.setValues({
    skus: nextSkus,
  });
  syncingState.current = false;
}

const components: ComponentMap = {
  Input: SchemaInput,
  Textarea: SchemaTextarea,
  Select: SchemaSelect,
  Checkbox,
  Switch,
  DateInput,
  ImageInput,
  ItemInput,
  RadioGroup,
  Rating,
  FormGrid,
  FormLayout,
  FormSection,
  ArrayCards,
  ArrayTable,
  SkuTable,
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
        handlers: schemaRendererHandlers,
        initialValues: schema.id === SKU_MATRIX_DEMO_ID ? createSkuDemoInitialValues() : undefined,
        setup:
          schema.id === SKU_MATRIX_DEMO_ID
            ? (instance) => {
                const syncingState = { current: false };
                return instance.effect(
                  (current) => current.getField(SKU_MATRIX_SPECS_PATH)?.value,
                  () => {
                    syncSkuMatrix(instance, syncingState);
                  },
                  {
                    immediate: true,
                    equals: (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
                  },
                );
              }
            : undefined,
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
              <FormProvider form={form} components={components} decorators={decorators}>
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
