import { FormProvider, SchemaField, useCreateForm } from '@alien-form/react';
import { Alert, Button, Descriptions, Drawer, Empty, Space, Spin } from 'antd';
import type { ButtonProps } from 'antd';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { renderDetailValue } from '../../core/format/format-value';
import * as adapters from '../../adapters';
import type { CmsModelSchema, DetailItemProjection, DrawerMode, ModelRecord } from '../../types/model';

const components = {
  Input: adapters.Input,
  Textarea: adapters.Textarea,
  NumberInput: adapters.NumberInput,
  Select: adapters.Select,
  Switch: adapters.Switch,
  DateInput: adapters.DateInput,
  Radio: adapters.Radio,
  CheckboxGroup: adapters.CheckboxGroup,
  Rate: adapters.Rate,
  ArrayCards: adapters.ArrayCards,
  SectionCard: adapters.SectionCard,
  TagsInput: adapters.TagsInput,
  SkuTable: adapters.SkuTable,
};

const decorators = {
  FormItem: adapters.FormItem,
};

interface DrawerSchemaFormProps {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
  submitText: string;
  submitButtonProps?: ButtonProps;
  loading?: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

function DrawerSchemaForm({
  schema,
  initialValues,
  submitText,
  submitButtonProps,
  loading,
  onSubmit,
  onCancel,
}: DrawerSchemaFormProps) {
  const form = useCreateForm({ schema, initialValues });

  return (
    <div className="drawer-form-layout">
      <FormProvider form={form} components={components as Record<string, any>} decorators={decorators as Record<string, any>}>
        <SchemaField />
      </FormProvider>
      <div className="drawer-footer-actions">
        <Space>
          <Button onClick={() => form.reset()}>重置</Button>
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            loading={loading}
            {...submitButtonProps}
            onClick={() => form.submit(onSubmit)}
          >
            {submitText}
          </Button>
        </Space>
      </div>
    </div>
  );
}

function buildDrawerMeta(mode: DrawerMode, singularLabel: string) {
  switch (mode) {
    case 'add':
      return {
        title: `新增${singularLabel}`,
        width: 680,
      };
    case 'edit':
      return {
        title: `编辑${singularLabel}`,
        width: 680,
      };
    case 'detail':
      return {
        title: `${singularLabel}详情`,
        width: 560,
      };
    default:
      return {
        title: singularLabel,
        width: 560,
      };
  }
}

interface ModelActionDrawerProps {
  mode: DrawerMode;
  singularLabel: string;
  addSchema: CmsModelSchema;
  editSchema: CmsModelSchema;
  detailItems: DetailItemProjection[];
  record?: ModelRecord;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmitAdd: (values: Record<string, unknown>) => Promise<void>;
  onSubmitEdit: (values: Record<string, unknown>) => Promise<void>;
}

export function ModelActionDrawer({
  mode,
  singularLabel,
  addSchema,
  editSchema,
  detailItems,
  record,
  loading,
  submitting,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}: ModelActionDrawerProps) {
  const open = mode !== 'closed';
  const meta = buildDrawerMeta(mode, singularLabel);
  const formKey = useMemo(() => `${mode}:${record?.id ?? 'new'}`, [mode, record?.id]);

  let content: ReactNode = null;

  if (mode === 'detail') {
    if (loading) {
      content = <Spin className="drawer-loading" />;
    } else if (!record) {
      content = <Empty description="暂无详情数据" />;
    } else {
      content = (
        <Descriptions column={1} bordered size="small">
          {detailItems.map((item) => (
            <Descriptions.Item key={item.key} label={item.title}>
              {renderDetailValue(record[item.key], {
                format: item.format,
                dataSource: item.dataSource,
              })}
            </Descriptions.Item>
          ))}
        </Descriptions>
      );
    }
  }

  if (mode === 'edit') {
    if (loading) {
      content = <Spin className="drawer-loading" />;
    } else if (!record) {
      content = <Alert type="warning" showIcon message="记录不存在或加载失败" />;
    } else {
      content = (
        <DrawerSchemaForm
          key={formKey}
          schema={editSchema}
          initialValues={record}
          submitText="保存修改"
          loading={submitting}
          onCancel={onClose}
          onSubmit={onSubmitEdit}
        />
      );
    }
  }

  if (mode === 'add') {
    content = (
      <DrawerSchemaForm
        key={formKey}
        schema={addSchema}
        submitText="创建记录"
        loading={submitting}
        onCancel={onClose}
        onSubmit={onSubmitAdd}
      />
    );
  }

  return (
    <Drawer
      destroyOnHidden
      title={meta.title}
      open={open}
      width={meta.width}
      onClose={onClose}
    >
      {content}
    </Drawer>
  );
}
