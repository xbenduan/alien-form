import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Flex, Space } from "antd";
import type { SchemaFormRef } from "@alien-form/shared";
import { PageBreadcrumb, PageError, PageLoading } from "../../../components";
import { useModelSchema, useRecordDetail, useRecordMutations } from "../../../hooks";
import { CompilerProvider, useCompiledSchema } from "../../../compiler";
import { recordListPath } from "../../../app/router/paths";
import { RecordActionForm } from "../components";
import type { RecordActionMode } from "../types";
import styles from "./index.module.css";

const TITLE: Record<Exclude<RecordActionMode, "closed">, string> = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
};

interface RecordActionPageProps {
  mode: Exclude<RecordActionMode, "closed">;
}

/** 记录动作页（整页形态）：add / edit / detail 共用，由 mode 区分。 */
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
  const schemaQuery = useModelSchema(modelName);
  const schema = schemaQuery.data;
  const compiledQuery = useCompiledSchema(schema);
  const detailQuery = useRecordDetail(modelName, recordId, mode !== "add");
  const mutations = useRecordMutations(modelName);
  const formRef = useRef<SchemaFormRef>(null);

  if (schemaQuery.isLoading || compiledQuery.isLoading || (mode !== "add" && detailQuery.isLoading))
    return <PageLoading />;
  if (schemaQuery.error || !schema || !compiledQuery.data) {
    return (
      <PageError title="模型不存在或加载失败" description={(schemaQuery.error as Error)?.message} />
    );
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
          formSchema={compiledQuery.data.form}
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
