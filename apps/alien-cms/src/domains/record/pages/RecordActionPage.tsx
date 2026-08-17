import { PageSchemaForm } from "@alien-form/shared";
import { Alert, App, Breadcrumb, Card, Flex, Spin } from "antd";
import { map as recordSchemaHandlers } from "../../../components/handlers";
import { useRecordStore } from "../hooks/use-record-store";
import type { RecordRouteState } from "../types/record";

interface RecordActionPageProps {
  modelName: string;
  routeAction: RecordRouteState;
  onRouteActionChange: (nextAction: RecordRouteState) => void;
}

function getActionLabel(mode: RecordRouteState["mode"], singularLabel: string) {
  switch (mode) {
    case "add":
      return `新增${singularLabel}`;
    case "edit":
      return `编辑${singularLabel}`;
    case "detail":
      return `${singularLabel}详情`;
    default:
      return "列表";
  }
}

export default function RecordActionPage({
  modelName,
  routeAction,
  onRouteActionChange,
}: RecordActionPageProps) {
  const { message: messageApi } = App.useApp();
  const page = useRecordStore(modelName, {
    routeAction,
    onRouteActionChange,
  });
  const singularLabel = page.schema?.["x-model"]?.singularLabel ?? "记录";
  const formKey = `${modelName}:${page.actionMode}:${page.activeRecordId ?? "new"}`;

  if (page.schemaLoading) {
    return (
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <div className="model-page-loading">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (page.schemaError || !page.schema) {
    return (
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <Alert
          type="error"
          showIcon
          message="模型不存在或加载失败"
          description={page.schemaError?.message}
        />
      </Card>
    );
  }

  if (page.actionMode === "closed") {
    return null;
  }

  return (
    <Flex gap={16} vertical>
      <Breadcrumb
        items={[
          {
            title: `${singularLabel}列表`,
            key: "list",
            href: `/records/${modelName}`,
          },
          { title: getActionLabel(page.actionMode, singularLabel), key: `${singularLabel}详情` },
        ]}
      />
      <div className="model-action-page">
        <div className="model-action-page-body">
          <PageSchemaForm
            mode={page.actionMode}
            schema={page.actionSchema ?? page.schema}
            formKey={formKey}
            initialValues={page.activeRecord}
            handlers={recordSchemaHandlers}
            loading={page.detailLoading}
            submitting={page.submitting}
            actions={{
              onCancel: page.closeAction,
              onSubmit: async (values, mode) => {
                if (mode === "add") {
                  await page.submitAdd(values);
                  messageApi.success("新增成功");
                  return;
                }
                await page.submitEdit(values);
                messageApi.success("保存成功");
              },
            }}
          />
        </div>
      </div>
    </Flex>
  );
}
