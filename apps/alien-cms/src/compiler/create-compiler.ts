import { SchemaCompiler } from "@alien-form/shared";
import { RuntimeCore } from "../runtime";
import type { ModelSchema } from "../runtime";

/**
 * 应用级 request：把 SchemaCompiler / 组件 service 的数据请求接到 services 层。
 * 编译期预取外键、组件 props 方案自取都走这一个入口。
 */
/**
 * 新建一个 SchemaCompiler 实例。
 * 每个 domain 页面建一个、退出销毁；locale 变化重建（locale 作为构造入参）。
 */
export function createAppCompiler(locale = "zh", domain?: string): SchemaCompiler {
  return new SchemaCompiler({
    service: (code) => RuntimeCore.current.service.query(code),
    constant: (key) => RuntimeCore.current.constant.all(domain)[key],
    loadSchema: async (modelCode): Promise<ModelSchema> => {
      const service = RuntimeCore.current.service.query("schema.get");
      if (!service) throw new Error("[alien-cms] service schema.get 未注册");
      return (await service.send({ name: modelCode })) as ModelSchema;
    },
    locale,
  });
}
