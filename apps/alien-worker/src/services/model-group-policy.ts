import { badRequest } from "../errors.ts";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import type { ModelGroupPolicy } from "./core/model-service.ts";
import categoryModule from "./models/_sys_model_category/index.ts";

/** 使用系统分类模型实现模型分组约束。 */
export class SystemModelGroupPolicy implements ModelGroupPolicy {
  constructor(
    private readonly models: ModelStore,
    private readonly records: RecordStore,
  ) {}

  async assertValid(group: string | undefined): Promise<void> {
    if (!group) throw badRequest("模型必须选择一个分类");
    const schema = await this.models.get(categoryModule.schema.name);
    if (!schema) throw badRequest("分类标签尚未初始化");
    const category = await this.records.findByField(schema, "code", group);
    if (!category || category.aggregate === true) {
      throw badRequest(`分类标签不存在或不可用于归类：${group}`);
    }
  }
}
