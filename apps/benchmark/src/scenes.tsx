import { useMemo } from "react";
import { Form as AntForm, Input as AntInput } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
} from "@alien-form/react";
import { createForm } from "@formily/core";
import {
  FormProvider as FormilyProvider,
  createSchemaField,
} from "@formily/react";
import { benchmarkComponents, benchmarkDecorators, formilyComponents } from "./components";

export interface SceneProps {
  count: number;
}

/** 用 JSON Schema 驱动 alien-form 渲染 count 个字段 */
export function AlienFormScene({ count }: SceneProps) {
  const schema = useMemo<IFormSchema>(() => {
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < count; i++) {
      properties[`name_${i}`] = {
        type: "string",
        title: `name ${i + 1}`,
        required: true,
        component: "Input",
        decorator: "FormItem",
        props: { placeholder: "Please Input" },
      };
    }
    return { type: "object", properties: properties as never };
  }, [count]);

  const form = useCreateForm({ schema }, [schema]);

  return (
    <FormProvider form={form} components={benchmarkComponents} decorators={benchmarkDecorators}>
      <AntForm layout="vertical">
        <SchemaField />
      </AntForm>
    </FormProvider>
  );
}

/** Formily SchemaField,benchmark 期间稳定复用 */
const FormilySchemaField = createSchemaField({ components: formilyComponents });

/** 用 JSON Schema 驱动 formily 渲染 count 个字段 */
export function FormilyScene({ count }: SceneProps) {
  const form = useMemo(() => createForm(), [count]);
  const schema = useMemo(() => {
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < count; i++) {
      properties[`name_${i}`] = {
        type: "string",
        title: `name ${i + 1}`,
        required: true,
        "x-decorator": "FormItem",
        "x-component": "Input",
        "x-decorator-props": { label: `name ${i + 1}`, required: true },
        "x-component-props": { placeholder: "Please Input" },
      };
    }
    return { type: "object", properties };
  }, [count]);

  return (
    <FormilyProvider form={form}>
      <AntForm layout="vertical">
        <FormilySchemaField schema={schema} />
      </AntForm>
    </FormilyProvider>
  );
}

/** 纯 Antd Form.Item 基线 */
export function PureAntdFormScene({ count }: SceneProps) {
  return (
    <AntForm layout="vertical">
      {Array.from({ length: count }).map((_, i) => (
        <AntForm.Item key={i} name={`name_${i}`} required label={`name ${i + 1}`}>
          <AntInput placeholder="Please Input" />
        </AntForm.Item>
      ))}
    </AntForm>
  );
}

/** 纯 Antd Input 基线(无 Form 包裹) */
export function PureAntdInputScene({ count }: SceneProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <AntInput key={i} placeholder="Please Input" style={{ marginBottom: 8 }} />
      ))}
    </>
  );
}

export const scenes = {
  alienForm: { label: "AlienForm (JSON Schema)", Component: AlienFormScene },
  formily: { label: "Formily (JSON Schema)", Component: FormilyScene },
  pureAntdForm: { label: "Pure Antd Form", Component: PureAntdFormScene },
  pureAntdInput: { label: "Pure Antd Input", Component: PureAntdInputScene },
} as const;

export type SceneKey = keyof typeof scenes;
