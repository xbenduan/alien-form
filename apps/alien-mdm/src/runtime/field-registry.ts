import type { ComponentType } from "react";
import type { Registry } from "@alien-form/engine";
import type { ModelFieldSchema, RegisteredFieldDefinition } from "../domains/model/builder/types";
import type { ComponentOption } from "@app-types/shared";

/**
 * 字段组件的注册表读取入口：非 register/ 代码统一通过这些方法解析组件定义，
 * 而不是直接 import register/ 内部的 fieldDefinitions。
 */
export function getFieldDefinition(
  registry: Registry,
  code?: string,
  domain?: string,
): RegisteredFieldDefinition | undefined {
  return code
    ? (registry.form.components.resolve(code, domain) as RegisteredFieldDefinition | undefined)
    : undefined;
}

export function getFieldComponents(
  registry: Registry,
  domain?: string,
): Record<string, RegisteredFieldDefinition["component"]> {
  return Object.fromEntries(
    Object.entries(registry.form.components.all(domain)).map(([code, definition]) => [
      code,
      definition.component,
    ]),
  ) as Record<string, RegisteredFieldDefinition["component"]>;
}

export function getFieldDecorators(
  registry: Registry,
  domain?: string,
): Record<string, ComponentType<unknown>> {
  return Object.fromEntries(
    Object.entries(registry.form.decorators.all(domain)).map(([code, definition]) => [
      code,
      definition.component,
    ]),
  ) as Record<string, ComponentType<unknown>>;
}

export function buildComponentOptions(
  registry: Registry,
  filter?: (definition: RegisteredFieldDefinition) => boolean,
  domain?: string,
): ComponentOption[] {
  return Object.values(
    registry.form.components.all(domain) as Record<string, RegisteredFieldDefinition>,
  )
    .filter((definition) => (filter ? filter(definition) : true))
    .map((definition) => ({ value: definition.code, label: definition.title }));
}

export function isContainerComponent(
  registry: Registry,
  component?: string,
  domain?: string,
): boolean {
  return Boolean(getFieldDefinition(registry, component, domain)?.authoring.children);
}

export function getDefaultFieldSchema(
  registry: Registry,
  component: string,
  domain?: string,
): ModelFieldSchema {
  const definition =
    getFieldDefinition(registry, component, domain) ??
    getFieldDefinition(registry, "Input", domain);
  if (!definition) throw new Error(`[alien-mdm] field definition "${component}" not found`);
  return definition.authoring.create();
}
