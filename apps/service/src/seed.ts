import { readFile } from "node:fs/promises";
import { FormworkError, modelDocumentSchema } from "formwork/model";
import type { JsonValue } from "formwork/model";
import type { createDevelopmentService } from "./app.js";

const records: Record<string, Record<string, JsonValue>[]> = {
  orders: [
    { id: "order-1", orderNo: "SO-2026-001", status: "pending", paid: false, amount: 120, lines: [{ sku: "SKU-A", quantity: 2 }] },
    { id: "order-2", orderNo: "SO-2026-002", status: "paid", paid: true, amount: 300, lines: [{ sku: "SKU-B", quantity: 3 }] },
    { id: "order-3", orderNo: "SO-2026-003", status: "pending", paid: false, amount: 0, lines: [] },
  ],
  cms: [{ id: "article-1", title: "欢迎使用 Formwork", content: "这是一条独立开发服务中的内容。\n正文由 cms Domain 编辑。" }],
};
/** 只初始化尚不存在的模型及记录，重启不会覆盖用户开发数据。 */
export async function seedDevelopment(service: ReturnType<typeof createDevelopmentService>, files: readonly string[]) {
  for (const file of files) {
    const document = modelDocumentSchema.parse(JSON.parse(await readFile(file, "utf8")));
    try { await service.models.read(document.id); continue; }
    catch (error) { if (!(error instanceof FormworkError) || error.code !== "NOT_FOUND") throw error; }
    await service.models.write(document, { ifRevision: null });
    for (const record of records[document.id] ?? []) {
      try { await service.records.create(document.id, record); }
      catch (error) { if (!(error instanceof FormworkError) || error.code !== "REVISION_CONFLICT") throw error; }
    }
  }
}
