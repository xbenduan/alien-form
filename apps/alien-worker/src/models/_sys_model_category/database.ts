import type { ModelDatabaseContext } from "@alien-form/alienbase";
import { ensureRecord } from "@alien-form/alienbase";

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
    },
    actorId,
  );
}
