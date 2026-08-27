import { useEffect, useMemo, useRef } from "react";
import { FormRenderer, useCreateForm } from "@alien-form/react";
import type { IFormSchema } from "@alien-form/core";
import { useBuilder, useBuilderAtom } from "@alien-form/builder/react";
import { getFieldComponents, getFieldDecorators } from "@runtime";
import type { ModelDraft } from "../builder";

interface ModelMetaFormProps {
  nameDisabled?: boolean;
}

const META_SCHEMA: IFormSchema = {
  type: "object",
  properties: {
    identity: {
      type: "void",
      "x-layout": "GridLayout",
      props: { columns: 3, gutter: 16 },
      properties: {
        name: {
          type: "string",
          title: "模型名",
          description: "只能使用字母、数字、下划线和中划线。",
          component: "Input",
          decorator: "FormItem",
          required: true,
        },
        title: {
          type: "string",
          title: "标题",
          component: "Input",
          decorator: "FormItem",
          required: true,
        },
        subtitle: {
          type: "string",
          title: "副标题",
          component: "Input",
          decorator: "FormItem",
        },
        group: {
          type: "string",
          title: "类型",
          component: "Select",
          decorator: "FormItem",
          dataSource: [
            { label: "系统", value: "system" },
            { label: "其他", value: "other" },
          ],
        },
        singularLabel: {
          type: "string",
          title: "单数标签",
          component: "Input",
          decorator: "FormItem",
        },
        pluralLabel: {
          type: "string",
          title: "复数标签",
          component: "Input",
          decorator: "FormItem",
        },
        filterCount: {
          type: "number",
          title: "筛选项数",
          component: "NumberInput",
          decorator: "FormItem",
          props: { min: 0 },
        },
        defaultPageSize: {
          type: "number",
          title: "每页数",
          component: "NumberInput",
          decorator: "FormItem",
          props: { min: 1 },
        },
        addOpenMode: {
          type: "string",
          title: "新增打开方式",
          component: "Select",
          decorator: "FormItem",
          dataSource: [
            { label: "整页", value: "page" },
            { label: "抽屉", value: "drawer" },
            { label: "弹窗", value: "modal" },
          ],
        },
        detailOpenMode: {
          type: "string",
          title: "详情打开方式",
          component: "Select",
          decorator: "FormItem",
          dataSource: [
            { label: "整页", value: "page" },
            { label: "抽屉", value: "drawer" },
            { label: "弹窗", value: "modal" },
          ],
        },
        editOpenMode: {
          type: "string",
          title: "编辑打开方式",
          component: "Select",
          decorator: "FormItem",
          dataSource: [
            { label: "整页", value: "page" },
            { label: "抽屉", value: "drawer" },
            { label: "弹窗", value: "modal" },
          ],
        },
      },
    },
    description: {
      type: "string",
      title: "描述",
      component: "Textarea",
      decorator: "FormItem",
      props: { rows: 3 },
    },
  },
};

function valuesOf(draft: ModelDraft) {
  return {
    name: draft.name,
    title: draft.title,
    subtitle: draft.subtitle,
    description: draft.description,
    group: draft.group,
    singularLabel: draft.singularLabel,
    pluralLabel: draft.pluralLabel,
    filterCount: draft.filterCount,
    defaultPageSize: draft.defaultPageSize,
    addOpenMode: draft.openMode.add,
    detailOpenMode: draft.openMode.detail,
    editOpenMode: draft.openMode.edit,
  };
}

/** 模型元信息完全通过 alien-form schema 构建和渲染。 */
export function ModelMetaForm({ nameDisabled }: ModelMetaFormProps) {
  const builder = useBuilder<ModelDraft>();
  const draft = useBuilderAtom(builder.document);
  const components = useMemo(
    () => getFieldComponents(builder.registry, builder.domain),
    [builder, builder.domain],
  );
  const decorators = useMemo(
    () => getFieldDecorators(builder.registry, builder.domain),
    [builder, builder.domain],
  );
  const syncing = useRef(false);
  const initialValues = useMemo(() => valuesOf(draft), []);
  const schema = useMemo<IFormSchema>(() => {
    if (!nameDisabled) return META_SCHEMA;
    const cloned = structuredClone(META_SCHEMA);
    const identity = cloned.properties?.identity;
    if (identity?.properties?.name) identity.properties.name.disabled = true;
    return cloned;
  }, [nameDisabled]);
  const form = useCreateForm({ schema, initialValues, scope: { mode: "edit" } }, [schema]);

  useEffect(() => {
    return form.effect(
      (current) => current.values(),
      (values) => {
        if (syncing.current) return;
        builder.dispatch("meta.update", {
          name: String(values.name ?? ""),
          title: String(values.title ?? ""),
          subtitle: String(values.subtitle ?? ""),
          description: String(values.description ?? ""),
          group: values.group === "system" ? "system" : "other",
          singularLabel: String(values.singularLabel ?? ""),
          pluralLabel: String(values.pluralLabel ?? ""),
          filterCount: Number(values.filterCount ?? 0),
          defaultPageSize: Number(values.defaultPageSize ?? 10),
          openMode: {
            add: values.addOpenMode ?? "drawer",
            detail: values.detailOpenMode ?? "drawer",
            edit: values.editOpenMode ?? "drawer",
          },
        });
      },
    );
  }, [builder, form]);

  useEffect(() => {
    syncing.current = true;
    form.setValues(valuesOf(draft));
    syncing.current = false;
  }, [draft, form]);

  return <FormRenderer form={form} components={components} decorators={decorators} />;
}
