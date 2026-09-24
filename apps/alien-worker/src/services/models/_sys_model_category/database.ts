import type { ModelDatabaseContext } from "../../define-model.ts";
import { ensureRecord } from "../../bootstrap.ts";

/** Seeds categories used by the model home page and editor. */
export async function initialize(
  context: ModelDatabaseContext,
  constants: {
    readonly code: string;
    readonly allId: string;
    readonly systemId: string;
    readonly otherId: string;
  },
  actorId: string,
): Promise<void> {
  await ensureRecord(
    context,
    constants.code,
    constants.allId,
    {
      code: "all",
      name: "全部",
      order: 0,
      aggregate: true,
      description: "聚合展示全部可访问模型。",
    },
    actorId,
  );
  await ensureRecord(
    context,
    constants.code,
    constants.systemId,
    {
      code: "system",
      name: "系统",
      order: 10,
      aggregate: false,
      description: "系统内置模型。",
    },
    actorId,
  );
  await ensureRecord(
    context,
    constants.code,
    constants.otherId,
    {
      code: "other",
      name: "其他",
      order: 20,
      aggregate: false,
      description: "默认业务模型分类。",
    },
    actorId,
  );
}
