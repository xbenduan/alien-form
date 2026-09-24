import type { AlienSchema } from "@alien-form/protocol";
import type {
  CompiledModelProvider,
  ModelCommand,
  ModelEventHandler,
  ModelMiddleware,
  RecordReader,
} from "./core/contracts.ts";

/** 启动初始化只能通过受控端口读取或写入模型数据。 */
export interface ModelDatabaseContext {
  models: Pick<CompiledModelProvider, "get">;
  records: Pick<RecordReader, "get" | "findByField">;
  create(model: string, values: Record<string, unknown>, actorId: string): Promise<unknown>;
  update(
    model: string,
    id: string,
    values: Record<string, unknown>,
    actorId: string,
  ): Promise<unknown>;
}

/** 模型数据库的启动阶段配置。 */
export interface ModelDatabaseConfig {
  /** 在模型协议发布后写入种子或初始数据，必须保持幂等。 */
  initialize?: (context: ModelDatabaseContext) => void | Promise<void>;
}

/** 一个代码模型通过 `{modelCode}/index.ts` 对外声明的完整配置。 */
export interface ModelModule {
  /** 模型协议，是字段、页面、关系和存储定义的唯一真相源。 */
  schema: AlienSchema;

  /** 模型内部共享的稳定常量，例如系统记录 ID；不会持久化到模型协议。 */
  constants?: Readonly<Record<string, unknown>>;

  /** 数据库准备和初始化逻辑，用于建表兼容与幂等种子数据写入。 */
  database?: ModelDatabaseConfig;

  /** 模型专属 CRUD 生命周期扩展，不能替代统一权限、校验和持久化流程。 */
  middleware?: ModelMiddleware;

  /** 模型专属业务命令；每个命令声明权限与允许写入的字段。 */
  commands?: Readonly<Record<string, ModelCommand>>;

  /** Outbox 事件消费者；仅在事务提交后由后台派发器调用。 */
  events?: Readonly<Record<string, ModelEventHandler>>;
}

/** 通过工厂定义代码模型，并保留返回配置的精确类型推导。 */
export function defineModel<const Module extends ModelModule>(
  factory: () => ModelModule & Module,
): Module {
  return factory();
}
