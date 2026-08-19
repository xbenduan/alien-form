import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Flex } from "antd";
import { PageError, PageLoading } from "../../../components";
import { useModelSchema, useRecordDetail, useRecordMutations } from "../../../hooks";
import { recordListPath } from "../../../app/router/paths";
import { RecordActionForm } from "../components";
import type { RecordActionMode } from "../types";
import styles from "./actions.module.css";

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
  const navigate = useNavigate();
  const { modelName = "", recordId } = useParams();
  const schemaQuery = useModelSchema(modelName);
  const schema = schemaQuery.data;
  const detailQuery = useRecordDetail(modelName, recordId, mode !== "add");
  const mutations = useRecordMutations(modelName);

  if (schemaQuery.isLoading || (mode !== "add" && detailQuery.isLoading)) return <PageLoading />;
  if (schemaQuery.error || !schema) {
    return <PageError title="模型不存在或加载失败" description={(schemaQuery.error as Error)?.message} />;
  }

  const { singularLabel } = schema.meta;
  const backToList = () => navigate(recordListPath(modelName));

  return (
    <Flex vertical gap={16}>
      <Breadcrumb
        items={[
          { title: `${singularLabel}列表`, href: recordListPath(modelName) },
          { title: `${TITLE[mode]}${singularLabel}` },
        ]}
      />
      <div className={styles.body}>
        <RecordActionForm
          mode={mode}
          schema={schema}
          record={mode === "add" ? undefined : detailQuery.data}
          formKey={`${modelName}:${mode}:${recordId ?? "new"}`}
          submitting={mutations.submitting}
          onCancel={backToList}
          onSubmitted={backToList}
          createRecord={mutations.createRecord}
          updateRecord={mutations.updateRecord}
        />
      </div>
    </Flex>
  );
}
