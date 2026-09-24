/**
 * 声明项目级 Core 工厂，并保留输入与运行时的完整类型推导。
 *
 * 工厂在宿主请求作用域内执行；AlienBase 不持有数据库连接或平台环境。
 * 返回的 Core 仅冻结顶层成员，服务实例内部状态仍由各自实现管理。
 */
export function defineCore<Input, Runtime extends object>(
  factory: (input: Input) => Runtime,
): (input: Input) => Readonly<Runtime> {
  return (input) => Object.freeze(factory(input));
}
