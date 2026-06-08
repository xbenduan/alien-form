import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Spin, message } from "antd";
import { useEffect } from "react";
import { useWorkbenchLayout } from "../../../app/layout/WorkbenchLayout";
import { useRecordStore } from "../../../hooks/use-record-store";
import PageSchemaForm from "../../../shared/components/PageSchemaForm";
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
  const { setBreadcrumb } = useWorkbenchLayout();
  const page = useRecordStore(modelName, {
    routeAction,
    onRouteActionChange,
  });
  const singularLabel = page.schema?.["x-model"]?.singularLabel ?? "记录";
  const currentActionLabel = getActionLabel(page.actionMode, singularLabel);
  const contentKey = `${page.actionMode}:${page.activeRecord?.id ?? "new"}:${page.activeRecord?.updatedAt ?? 0}`;

  useEffect(() => {
    setBreadcrumb({
      items: [
        { title: "模型管理" },
        { title: page.schema?.["x-model"]?.title ?? modelName },
        {
          title: page.schemaLoading
            ? "加载中"
            : page.schemaError || !page.schema
              ? "未找到模型"
              : currentActionLabel,
        },
      ],
      extra: (
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={page.closeAction}>
          返回列表
        </Button>
      ),
    });

    return () => setBreadcrumb(null);
  }, [
    currentActionLabel,
    modelName,
    page.closeAction,
    page.schema,
    page.schemaError,
    page.schemaLoading,
    setBreadcrumb,
  ]);

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
    <Card className="model-action-page" styles={{ body: { padding: 24 } }}>
      <div className="model-action-page-body">
        <PageSchemaForm
          key={contentKey}
          mode={page.actionMode}
          schema={page.schema}
          initialValues={page.activeRecord}
          loading={page.detailLoading}
          submitting={page.submitting}
          onClose={page.closeAction}
          onSubmitAdd={async (values) => {
            await page.submitAdd(values);
            message.success("新增成功");
          }}
          onSubmitEdit={async (values) => {
            await page.submitEdit(values);
            message.success("保存成功");
          }}
        />
      </div>
    </Card>
  );
}
