import type { ModelNavigationEntry, ModelNavigationSnapshot } from "formwork/model";
import type { Actor } from "../contracts";
import { readHead, readPublished } from "../adapters/d1/repositories/models";
import { accessFor } from "./auth/access";
import { requireUser } from "./auth/service";
import { assertModelId } from "./model-service";
import { forbidden, invalid, notFound } from "../http/errors";

const systemOrder = ["system-users", "system-roles", "system-model-categories"];

/** 按已发布版本和记录读取权限生成菜单，并持久化当前账号的固定偏好。 */
export class ModelNavigation {
  constructor(
    private readonly db: D1Database,
    private readonly actor: Actor,
  ) {
    requireUser(actor);
  }

  async read(): Promise<ModelNavigationSnapshot> {
    const heads = (
      await this.db
        .prepare("SELECT id FROM fw_models WHERE active_version IS NOT NULL ORDER BY id")
        .all<{ id: string }>()
    ).results;
    const readable = new Map<string, ModelNavigationEntry>();
    for (const { id } of heads) {
      const model = await readPublished(this.db, id);
      if (accessFor(model, this.actor, "read").allowed)
        readable.set(id, { id, title: model.definition.document.title || id });
    }
    const systemModels = [...readable.values()]
      .filter(({ id }) => id.startsWith("system-"))
      .sort((a, b) => {
        const rank = (id: string) => {
          const index = systemOrder.indexOf(id);
          return index < 0 ? systemOrder.length : index;
        };
        return rank(a.id) - rank(b.id) || a.id.localeCompare(b.id);
      });
    const pins = (
      await this.db
        .prepare(
          "SELECT model_id FROM fw_model_menu_pins WHERE user_id = ? ORDER BY created_at, model_id",
        )
        .bind(this.actor.id)
        .all<{ model_id: string }>()
    ).results;
    return {
      systemModels,
      pinnedModels: pins.flatMap(({ model_id }) => {
        const entry = readable.get(model_id);
        return entry && !model_id.startsWith("system-") ? [entry] : [];
      }),
      pinnableModelIds: [...readable.keys()].filter((id) => !id.startsWith("system-")),
    };
  }

  private assertUserModel(id: string) {
    assertModelId(id);
    if (id.startsWith("system-")) invalid("系统模型直接显示在菜单中，无需固定");
  }

  async pin(id: string): Promise<ModelNavigationSnapshot> {
    this.assertUserModel(id);
    const head = await readHead(this.db, id);
    if (!head) notFound(`模型 ${id} 不存在`);
    if (head.active_version === null) invalid("模型发布后可固定");
    const model = await readPublished(this.db, id);
    if (!accessFor(model, this.actor, "read").allowed) forbidden("无记录读取权限");
    await this.db
      .prepare(
        "INSERT INTO fw_model_menu_pins(user_id, model_id, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id, model_id) DO NOTHING",
      )
      .bind(this.actor.id, id, new Date().toISOString())
      .run();
    return this.read();
  }

  async unpin(id: string): Promise<ModelNavigationSnapshot> {
    this.assertUserModel(id);
    await this.db
      .prepare("DELETE FROM fw_model_menu_pins WHERE user_id = ? AND model_id = ?")
      .bind(this.actor.id, id)
      .run();
    return this.read();
  }
}
