import type { Registry } from "@alien-form/engine";
import {
  buildComponentOptions,
  getFieldDefinition,
  isContainerComponent,
} from "../../../register/global/form/registry";

export function fieldComponentOptions(registry: Registry, domain?: string) {
  return buildComponentOptions(
    registry,
    (definition) => definition.authoring.kind !== "layout",
    domain,
  );
}

export function groupComponentOptions(registry: Registry, domain?: string) {
  return buildComponentOptions(
    registry,
    (definition) => definition.authoring.kind === "layout",
    domain,
  );
}

export function isContainerField(registry: Registry, component?: string, domain?: string): boolean {
  return isContainerComponent(registry, component, domain);
}

export function componentAlias(registry: Registry, component?: string, domain?: string): string {
  return getFieldDefinition(registry, component, domain)?.title ?? component ?? "";
}

export function componentDescription(
  registry: Registry,
  component?: string,
  domain?: string,
): string {
  return getFieldDefinition(registry, component, domain)?.description ?? "";
}
