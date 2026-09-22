import { defineEnum, type Runtime } from "@alien-form/engine";

export function registerEnums(runtime: Runtime): void {
  runtime.enum(
    "fieldTypes",
    defineEnum(
      [
        { label: "文本", value: "string" },
        { label: "数字", value: "number" },
        { label: "布尔", value: "boolean" },
        { label: "对象", value: "object" },
        { label: "数组", value: "array" },
      ],
      { description: "字段类型" },
    ),
  );
  runtime.enum(
    "status",
    defineEnum(
      [
        { label: "启用", value: "active" },
        { label: "停用", value: "inactive" },
      ],
      { description: "启停状态" },
    ),
  );
}
