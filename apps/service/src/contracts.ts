import type { JsonValue } from "formwork/model";

/** 保存独立开发服务中的完整记录。 */
export type RecordValue = Record<string, JsonValue> & { id: string };
/** 描述已应用的标量筛选和稳定分页排序。 */
export type RecordQuery = { filters: Record<string, JsonValue>; page: number; pageSize: number; sort?: { field: string; direction: "asc" | "desc" } };
/** 返回完整记录分页及筛选后的总数。 */
export type RecordPage = { list: RecordValue[]; total: number };
