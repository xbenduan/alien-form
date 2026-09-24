import {
  badRequest,
  type CompiledModelProvider,
  type ModelGroupPolicy,
  type RecordReader,
} from "@alien-form/alienbase";
import categoryModule from "../models/_sys_model_category/index.ts";

/** 使用系统分类模型实现模型分组约束。 */
export class SystemModelGroupPolicy implements ModelGroupPolicy {
  constructor(
    private readonly models: CompiledModelProvider,
    private readonly records: RecordReader,
  ) {}

  async assertValid(group: string | undefined): Promise<void> {
    if (!group) throw badRequest("模型必须选择一个分类");
    const model = await this.models.get(categoryModule.schema.name);
    if (!model) throw badRequest("分类标签尚未初始化");
    const category = await this.records.findByField(model, "code", group);
    if (!category || category.aggregate === true) {
      throw badRequest(`分类标签不存在或不可用于归类：${group}`);
    }
  }
}
