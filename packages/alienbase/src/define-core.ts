/** 项目级 Core 的静态定义与请求级运行时工厂。 */
export interface CoreDefinition<Input, Models extends object, Runtime extends object> {
  /** 代码模型加载表，也是构建器可见的完整模型能力清单。 */
  models: Models;

  /** 使用宿主请求输入创建隔离的 Core 运行时。 */
  create(input: Input, models: Readonly<Models>): Runtime;
}

/** 可调用的请求级 Core 工厂，同时暴露不可变的代码模型能力清单。 */
export type CoreFactory<Input, Models extends object, Runtime extends object> = ((
  input: Input,
) => Readonly<Runtime>) & {
  readonly models: Readonly<Models>;
};

/**
 * 声明项目级 Core，并保留模型清单、宿主输入与运行时的完整类型推导。
 *
 * 定义工厂仅在模块加载时执行一次；`create` 在宿主请求作用域内执行。
 * 返回的 Core 仅冻结顶层成员，服务实例内部状态仍由各自实现管理。
 */
export function defineCore<Input, Models extends object, Runtime extends object>(
  factory: () => CoreDefinition<Input, Models, Runtime>,
): CoreFactory<Input, Models, Runtime> {
  const definition = factory();
  const models = Object.freeze(definition.models) as Readonly<Models>;
  const create = (input: Input): Readonly<Runtime> =>
    Object.freeze(definition.create(input, models));

  return Object.freeze(Object.assign(create, { models }));
}
