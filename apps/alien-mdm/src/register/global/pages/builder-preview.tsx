import { App, Button, Space } from "antd";
import { FormBlockRenderer, useFormBlock, type ComponentProps } from "@alien-form/engine/react";

export function BuilderPreview({ node }: ComponentProps) {
  const { message } = App.useApp();
  const form = useFormBlock(node.block ?? "form");
  return (
    <Space vertical size={16} style={{ width: "100%" }}>
      <FormBlockRenderer blockName={node.block ?? "form"} />
      <Space>
        <Button
          type="primary"
          loading={form.submitting}
          onClick={async () => {
            if (await form.validate()) message.success("表单校验通过");
          }}
        >
          提交
        </Button>
        <Button onClick={form.reset}>重置</Button>
      </Space>
    </Space>
  );
}
