import {
  AccessControl,
  ModelService,
  RecordService,
  defineCore,
  type ModelDatabaseContext,
} from "@alien-form/alienbase";
import { D1ModelRepository } from "../adapters/d1/repositories/model-repository.ts";
import { D1OutboxRepository } from "../adapters/d1/repositories/outbox-repository.ts";
import { D1RecordExpander } from "../adapters/d1/repositories/record-expander.ts";
import { D1RecordRepository } from "../adapters/d1/repositories/record-repository.ts";
import { D1SessionRepository } from "../adapters/d1/repositories/session-repository.ts";
import { compileModel } from "../adapters/d1/compiler/model-compiler.ts";
import { RoleAccessProfileProvider } from "../application/auth/access-profile-provider.ts";
import { AuthService } from "../application/auth/auth-service.ts";
import { CompiledModels } from "../application/compiled-models.ts";
import { OutboxDispatcher } from "../application/events/outbox-dispatcher.ts";
import { SystemModelGroupPolicy } from "../application/model-group-policy.ts";
import { modelModules, type ModelModules } from "../application/model-modules.ts";
import categoryModule from "../models/_sys_model_category/index.ts";

export interface WorkerCoreInput {
  /** 当前 Worker 请求可用的 D1 binding。 */
  db: D1Database;

  /** 代码模型注册表；测试可以注入最小模型集合。 */
  modules?: ModelModules;
}

/** AlienBase 在当前 Worker 项目中的唯一组合根。 */
export const createCore = defineCore(({ db, modules = modelModules }: WorkerCoreInput) => {
  const modelRepository = new D1ModelRepository(db);
  const compiledModels = new CompiledModels(modelRepository, modules, compileModel);
  const recordRepository = new D1RecordRepository(db);
  const outboxRepository = new D1OutboxRepository(db);
  const sessionRepository = new D1SessionRepository(db);
  const refs = new D1RecordExpander(db, compiledModels);
  const profiles = new RoleAccessProfileProvider(compiledModels, recordRepository);
  const access = new AccessControl(profiles, {
    publicModelNames: new Set([categoryModule.schema.name]),
  });
  const models = new ModelService(
    modelRepository,
    access,
    compiledModels,
    new SystemModelGroupPolicy(compiledModels, recordRepository),
  );
  const records = new RecordService(
    compiledModels,
    recordRepository,
    recordRepository,
    refs,
    access,
  );

  return {
    models,
    records,
    auth: new AuthService(compiledModels, recordRepository, sessionRepository, profiles),
    events: new OutboxDispatcher(outboxRepository, compiledModels),

    /** 发布代码模型并执行其幂等初始化逻辑。 */
    async initialize(): Promise<void> {
      const definitions = await modules.entries();
      for (const module of definitions) await models.ensureSystemModel(module.schema);
      const context: ModelDatabaseContext = {
        models: compiledModels,
        records: recordRepository,
        create: (model, values, actorId) => records.create(model, values, actorId),
        update: (model, id, values, actorId) => records.update(model, id, values, actorId),
      };
      for (const module of definitions) await module.database?.initialize?.(context);
    },
  };
});

export type WorkerCore = ReturnType<typeof createCore>;

/**
 * 同一 isolate 的并发请求共享初始化；失败后允许下一次请求重试。
 */
export function createCoreInitializer(): (core: WorkerCore) => Promise<void> {
  let initialization: Promise<void> | undefined;
  return async (core) => {
    if (!initialization) {
      initialization = core.initialize().catch((reason: unknown) => {
        initialization = undefined;
        throw reason;
      });
    }
    await initialization;
  };
}

export const initializeCore = createCoreInitializer();
