import { defineUtil, type Runtime } from "@alien-form/engine";
import { message } from "antd";
import { openRoute } from "./navigation";
import { relation } from "./relation";
import { schemaToColumns, schemaToFilterFields } from "./schema";
import { tree } from "./tree";

export function registerUtils(runtime: Runtime): void {
  runtime.util("schemaToColumns", defineUtil(schemaToColumns, { description: "表单字段转表格列" }));
  runtime.util(
    "schemaToFilterFields",
    defineUtil(schemaToFilterFields, { description: "表单字段转筛选项" }),
  );
  runtime.util("relation", defineUtil(relation, { description: "关联选项适配器" }));
  runtime.util("tree", defineUtil(tree, { description: "树形数据适配器" }));
  runtime.util("message", defineUtil(message, { description: "消息反馈" }));
  runtime.util("openRoute", defineUtil(openRoute, { description: "打开记录路由" }));
}
