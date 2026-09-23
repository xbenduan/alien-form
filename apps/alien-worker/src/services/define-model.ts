import type { AlienSchema } from "@alien-form/protocol";
import type { Container } from "../container.ts";
import type {
  ModelPersistMiddleware,
  ModelPrepareMiddleware,
  ModelPresentMiddleware,
  ModelValidateMiddleware,
} from "./types.ts";

/** 模型专属的固定生命周期扩展；各阶段最多声明一个函数。 */
export interface ModelMiddleware {
  /** 在新增或更新时规范化输入并生成服务端字段，早于协议校验执行。 */
  prepare?: ModelPrepareMiddleware;

  /** 校验规范化后的完整记录，可通过只读数据端口检查跨模型约束。 */
  validate?: ModelValidateMiddleware;

  /** 在新增、更新或删除提交前检查持久化约束，不允许直接写数据库。 */
  beforePersist?: ModelPersistMiddleware;

  /** 在数据库提交成功后执行非关键副作用；失败只记录日志，不回滚数据。 */
  afterCommit?: ModelPersistMiddleware;

  /** 在权限裁剪完成后转换响应记录，无法访问已被隐藏的字段。 */
  present?: ModelPresentMiddleware;
}

/** 模型数据库的启动阶段配置。 */
export interface ModelDatabaseConfig {
  /** 在模型协议发布前准备兼容所需的数据库结构，必须可重复执行。 */
  prepare?: (container: Container) => void | Promise<void>;

  /** 在模型协议发布后写入种子或初始数据，必须保持幂等。 */
  initialize?: (container: Container) => void | Promise<void>;
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
}

/** 通过工厂定义代码模型，并保留返回配置的精确类型推导。 */
export function defineModel<const Module extends ModelModule>(
  factory: () => ModelModule & Module,
): Module {
  return factory();
}
