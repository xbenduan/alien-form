import { App, Flex } from "antd";
import { useParams } from "react-router-dom";
import { PageBreadcrumb, PageError, PageLoading } from "../../../components";
import { CompilerProvider } from "../../../compiler";
import { RenderNode, RuntimeCore } from "../../../runtime";
import type { PageContext } from "../../../runtime";
import { RecordActionOverlay } from "../components";
import { useRecordPage } from "../hooks";

/** 记录列表页：布局完全由 Schema.x-layout 协议节点树驱动。 */
export default function RecordListPage() {
  const { modelName = "" } = useParams();
  return (
    <CompilerProvider domain={modelName}>
      <RecordListContent modelName={modelName} />
    </CompilerProvider>
  );
}

function RecordListContent({ modelName }: { modelName: string }) {
  const { message } = App.useApp();
  const page = useRecordPage(modelName);

  if (page.schemaLoading) return <PageLoading />;
  if (page.schemaError || !page.schema || !page.compiled) {
    return <PageError title="模型不存在或加载失败" description={page.schemaError?.message} />;
  }
  if (!page.compiled.layout) {
    return <PageError title="模型布局协议缺失" description="Schema 必须包含合法的 x-layout。" />;
  }

  const context: PageContext = {
    model: modelName,
    schema: page.schema as unknown as Record<string, unknown>,
    compiled: page.compiled as unknown as Record<string, unknown>,
    runtime: RuntimeCore.current,
    page,
  };

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: page.schema.meta.title }]} />
      <RenderNode node={page.compiled.layout} ctx={context} />
      <RecordActionOverlay
        modelName={modelName}
        schema={page.schema}
        formSchema={page.compiled.form}
        overlay={page.overlay}
        submitting={page.submitting}
        onClose={page.closeOverlay}
        createRecord={async (values) => {
          await page.createRecord(values);
          message.success("创建成功");
        }}
        updateRecord={async (id, values) => {
          await page.updateRecord(id, values);
          message.success("更新成功");
        }}
      />
    </Flex>
  );
}
