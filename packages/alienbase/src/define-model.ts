import type { AlienSchema } from "@alien-form/protocol";
import type {
  CompiledModelProvider,
  ModelCommand,
  ModelEventHandler,
  ModelMiddleware,
  RecordReader,
} from "./runtime/contracts.ts";

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
  /** 在系统物理表迁移完成后写入种子或初始数据，必须保持幂等。 */
  initialize?: (context: ModelDatabaseContext) => void | Promise<void>;
}

/** 使用稳定 ID 创建不存在的初始化记录。 */
export async function ensureRecord(
  context: ModelDatabaseContext,
  model: string,
  id: string,
  values: Record<string, unknown>,
  actorId: string,
): Promise<void> {
  const compiled = await context.models.get(model);
  if (!compiled) throw new Error(`内置模型未注册：${model}`);
  if (await context.records.get(compiled, id)) return;
  await context.create(model, { id, ...values }, actorId);
}

/** 模型可复用的受控运行时行为。 */
interface ModelBehavior {
  /** 模型内部共享的稳定常量，例如系统记录 ID；不会持久化到模型协议。 */
  constants?: Readonly<Record<string, unknown>>;

  /** 数据库迁移完成后的幂等种子或初始数据写入逻辑。 */
  database?: ModelDatabaseConfig;

  /** 模型专属 CRUD 生命周期扩展，不能替代统一权限、校验和持久化流程。 */
  middleware?: ModelMiddleware;

  /** 模型专属业务命令；每个命令声明权限与允许写入的字段。 */
  commands?: Readonly<Record<string, ModelCommand>>;

  /** Outbox 事件消费者；仅在事务提交后由后台派发器调用。 */
  events?: Readonly<Record<string, ModelEventHandler>>;
}

/** 模型行为匹配器的只读上下文。 */
export interface ModelMatchContext {
  /** 当前待编译的统一模型协议。 */
  readonly schema: AlienSchema;
}

/** 由代码持有 Schema 的精确模型定义，模型名只取自 `schema.name`。 */
export interface SchemaModelDefinition extends ModelBehavior {
  schema: AlienSchema;
  name?: never;
  match?: never;
}

/** 按模型名装饰一个数据库模型。 */
export interface NamedModelDefinition extends ModelBehavior {
  name: string;
  schema?: never;
  match?: never;
}

/** 按协议特征装饰一组模型。 */
export interface MatchedModelDefinition extends ModelBehavior {
  match(context: ModelMatchContext): boolean;
  schema?: never;
  name?: never;
}

/** 一个静态注册的 Schema 定义或行为定义。 */
export type ModelDefinition = SchemaModelDefinition | NamedModelDefinition | MatchedModelDefinition;

/** 声明模型 Schema 或运行时行为，并保留配置的精确类型推导。 */
export function defineModel<const Definition extends ModelDefinition>(
  definition: Definition,
): Definition {
  const selectors = [definition.schema, definition.name, definition.match].filter(
    (selector) => selector !== undefined,
  );
  if (selectors.length !== 1) {
    throw new Error("模型定义必须且只能声明 schema、name 或 match 之一");
  }
  return definition;
}
