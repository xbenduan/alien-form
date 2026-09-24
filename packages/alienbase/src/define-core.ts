/**
 * 声明项目级 Core 工厂，并保留输入与运行时的完整类型推导。
 *
 * 工厂在宿主请求作用域内执行；AlienBase 不持有数据库连接或平台环境。
 */
export function defineCore<Input, Runtime>(
  factory: (input: Input) => Runtime,
): (input: Input) => Runtime {
  return factory;
}
