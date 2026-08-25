import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Flex, Space } from "antd";
import { useQuery } from "@tanstack/react-query";
import type { SchemaFormRef } from "../../../components/SchemaForm";
import { PageBreadcrumb, PageError, PageLoading } from "../../../components";
import { CompilerProvider } from "../../../compiler";
import { useRecordPage } from "../hooks/use-record-page";
import { useRecordMutations } from "../../../hooks";
import { getAppRuntime } from "../../../runtime/create-runtime";
import { recordListPath } from "../../../app/router/paths";
import { RecordActionForm } from "../components";
import type { RecordActionMode } from "../types";
import styles from "./index.module.css";
import type { ModelRecord } from "../../../runtime/types";

const TITLE: Record<Exclude<RecordActionMode, "closed">, string> = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
};

interface RecordActionPageProps {
  mode: Exclude<RecordActionMode, "closed">;
}

export default function RecordActionPage({ mode }: RecordActionPageProps) {
  return (
    <CompilerProvider>
      <RecordActionContent mode={mode} />
    </CompilerProvider>
  );
}

function RecordActionContent({ mode }: RecordActionPageProps) {
  const navigate = useNavigate();
  const { modelName = "", recordId } = useParams();
  const { schema, compiled, schemaLoading, schemaError } = useRecordPage(modelName);
  const mutations = useRecordMutations(modelName);
  const runtime = getAppRuntime();
  const formRef = useRef<SchemaFormRef>(null);

  const detailQuery = useQuery({
    queryKey: ["records", modelName, "detail", recordId],
    enabled: mode !== "add" && Boolean(recordId),
    queryFn: async () => {
      const svc = runtime.registry.services.resolve("records.get");
      if (!svc) throw new Error("records.get not registered");
      return (await svc.send({ model: modelName, id: recordId })) as ModelRecord;
    },
  });

  if (schemaLoading || (mode !== "add" && detailQuery.isLoading)) return <PageLoading />;
  if (schemaError || !schema || !compiled) {
    return <PageError title="模型不存在或加载失败" description={schemaError?.message} />;
  }

  const { singularLabel } = schema.meta;
  const backToList = () => navigate(recordListPath(modelName));

  return (
    <Flex className={`${styles.actionsPage} ${styles.page}`} vertical gap={16}>
      <PageBreadcrumb
        items={[
          { title: `${singularLabel}列表`, to: recordListPath(modelName) },
          { title: `${TITLE[mode]}${singularLabel}` },
        ]}
      />
      <div className={styles.body}>
        <RecordActionForm
          mode={mode}
          formSchema={compiled.form}
          record={mode === "add" ? undefined : detailQuery.data}
          formKey={`${modelName}:${mode}:${recordId ?? "new"}`}
          formRef={formRef}
          submitting={mutations.submitting}
          onSubmitted={backToList}
          createRecord={mutations.createRecord}
          updateRecord={mutations.updateRecord}
        />
      </div>
      <div className={styles.footerRoot}>
        <div className={styles.footer}>
          <Space>
            <Button onClick={backToList}>返回</Button>
            {mode === "detail" ? null : (
              <Button
                type="primary"
                loading={mutations.submitting}
                onClick={() => formRef.current?.submit()}
              >
                {mode === "add" ? "创建" : "保存"}
              </Button>
            )}
          </Space>
        </div>
      </div>
    </Flex>
  );
}
