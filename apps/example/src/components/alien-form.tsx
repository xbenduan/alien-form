/**
 * AlienForm — wrapper that wires antd components into alien-form.
 */
import React, { useMemo } from "react";
import { Form } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
  type FormConfig,
  type ComponentMap,
  type DecoratorMap,
} from "@alien-form/react";
import { Input, Textarea, Select, Switch, DateInput, Radio, CheckboxGroup, Rate } from "./antd-components";
import { FormItem } from "./antd-decorator";
import { ArrayCards } from "./antd-array-cards";

const defaultComponents: ComponentMap = {
  Input,
  Textarea,
  Select,
  Switch,
  DateInput,
  Radio,
  CheckboxGroup,
  Rate,
  ArrayCards,
};

const defaultDecorators: DecoratorMap = {
  FormItem,
};

interface AlienFormProps {
  schema: IFormSchema;
  initialValues?: Record<string, any>;
  components?: ComponentMap;
  decorators?: DecoratorMap;
  handlers?: FormConfig["handlers"];
  scope?: FormConfig["scope"];
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
  children?: React.ReactNode;
}

export const AlienForm: React.FC<AlienFormProps> = ({
  schema,
  initialValues,
  components,
  decorators,
  handlers,
  scope,
  onSubmit,
  children,
}) => {
  const form = useCreateForm({ initialValues, handlers, scope });

  const mergedComponents = useMemo(
    () => ({ ...defaultComponents, ...components }),
    [components],
  );
  const mergedDecorators = useMemo(
    () => ({ ...defaultDecorators, ...decorators }),
    [decorators],
  );

  return (
    <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
      <FormProvider form={form} components={mergedComponents} decorators={mergedDecorators}>
        <SchemaField schema={schema} />
        {children}
      </FormProvider>
    </Form>
  );
};

export { useCreateForm, FormProvider, SchemaField } from "@alien-form/react";
export type { IFormSchema, FormConfig } from "@alien-form/react";
