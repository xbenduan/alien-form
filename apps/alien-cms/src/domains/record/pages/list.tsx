import { App, Flex } from "antd";
import { useParams } from "react-router-dom";
import { useMemo } from "react";
import { PageBreadcrumb, PageError, PageLoading } from "../../../components";
import { CompilerProvider } from "../../../compiler";
import { readLayoutServices, RenderNode, RuntimeCore } from "../../../runtime";
import type { PageContext } from "../../../runtime";
import { useRecordMutations } from "../../../hooks";
import { RecordActionOverlay } from "../components";
import { useRecordPage } from "../hooks";

/** 记录列表页：布局完全由 Schema.x-layout 协议节点树驱动，service 由根节点 props.services 声明。 */
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

  const services = useMemo(
    () => (page.compiled ? readLayoutServices(page.compiled.layout) : {}),
    [page.compiled],
  );

  const context: PageContext = useMemo(
    () => ({
      model: modelName,
      schema: (page.schema ?? {}) as unknown as Record<string, unknown>,
      compiled: (page.compiled ?? {}) as unknown as Record<string, unknown>,
      runtime: RuntimeCore.current,
      services,
      scope: page.scope,
      page: {
        openAdd: page.openAdd,
        openEdit: page.openEdit,
        openDetail: page.openDetail,
      },
    }),
    [modelName, page.schema, page.compiled, page.scope, page.openAdd, page.openEdit, page.openDetail, services],
  );

  const mutations = useRecordMutations(context);

  if (page.schemaLoading) return <PageLoading />;
  if (page.schemaError || !page.schema || !page.compiled) {
    return <PageError title="模型不存在或加载失败" description={page.schemaError?.message} />;
  }
  if (!page.compiled.layout) {
    return <PageError title="模型布局协议缺失" description="Schema 必须包含合法的 x-layout。" />;
  }

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: page.schema.meta.title }]} />
      <RenderNode node={page.compiled.layout} ctx={context} />
      <RecordActionOverlay
        modelName={modelName}
        schema={page.schema}
        formSchema={page.compiled.form}
        overlay={page.overlay}
        submitting={mutations.submitting}
        serviceCtx={context}
        onClose={page.closeOverlay}
        createRecord={async (values) => {
          await mutations.createRecord(values);
          message.success("创建成功");
        }}
        updateRecord={async (id, values) => {
          await mutations.updateRecord(id, values);
          message.success("更新成功");
        }}
      />
    </Flex>
  );
}
