import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { FormInstance } from '@alien-form/react';
import type { ButtonProps } from 'antd';
import { Button, Space } from 'antd';
import { createContext, useContext } from 'react';

export interface FormActionContextValue {
  kind: 'filter' | 'submit';
  loading?: boolean;
  submitText?: string;
  submitButtonProps?: ButtonProps;
  showReset?: boolean;
  showCancel?: boolean;
  showExpandButton?: boolean;
  expanded?: boolean;
  onSubmit?: (values: Record<string, unknown>) => Promise<void> | void;
  onSubmitError?: (error: unknown) => void;
  onReset?: () => void;
  onCancel?: () => void;
  onToggleExpanded?: () => void;
}

export const FormActionContext = createContext<FormActionContextValue | null>(null);

export function FormActions({ form }: { form: FormInstance }) {
  const ctx = useContext(FormActionContext);

  if (!ctx) return null;

  const {
    kind,
    loading,
    submitText,
    submitButtonProps,
    showReset,
    showCancel,
    showExpandButton,
    expanded,
    onSubmit,
    onSubmitError,
    onReset,
    onCancel,
    onToggleExpanded,
  } = ctx;

  return (
    <Space size={8}>
      <Button
        type="primary"
        icon={kind === 'filter' ? <SearchOutlined /> : undefined}
        loading={loading}
        onClick={() => {
          void form
            .submit(async (values) => {
              await onSubmit?.(values);
            })
            .catch((error) => {
              onSubmitError?.(error);
            });
        }}
        {...submitButtonProps}
      >
        {submitText ?? (kind === 'filter' ? '查询' : '提交')}
      </Button>
      {showReset ? (
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            form.setInitialValues({});
            form.reset();
            onReset?.();
          }}
        >
          重置
        </Button>
      ) : null}
      {showCancel ? <Button onClick={onCancel}>取消</Button> : null}
      {showExpandButton ? (
        <Button type="link" onClick={onToggleExpanded} style={{ paddingInline: 4 }}>
          {expanded ? '收起' : '展开'}
        </Button>
      ) : null}
    </Space>
  );
}
