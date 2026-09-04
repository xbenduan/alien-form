import { containsCompiledValue, evaluateCompiledValue } from "@alien-form/engine";
import { shallowEqual, useSignalSnapshot } from "@alien-form/react";
import { Alert } from "antd";
import { createElement, useCallback, type ComponentType, type ReactNode } from "react";
import { useRuntime } from "./runtime-provider";

export type ValueSource<T> = T | (() => T);

function readSource<T>(source: ValueSource<T>): T {
  return typeof source === "function" ? (source as () => T)() : source;
}

export function useCompiledProps(
  props: ValueSource<Record<string, unknown>>,
  scope: ValueSource<Record<string, unknown>>,
): Record<string, unknown> {
  const read = useCallback(() => {
    const source = readSource(props);
    return containsCompiledValue(source)
      ? evaluateCompiledValue(source, readSource(scope))
      : source;
  }, [props, scope]);
  return useSignalSnapshot(read, shallowEqual);
}

interface RuntimeComponentProps {
  code: string;
  domain?: string;
  props?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  context?: Record<string, unknown>;
  children?: ReactNode;
}

export function RuntimeComponent({
  code,
  domain,
  props,
  bindings,
  context,
  children,
}: RuntimeComponentProps) {
  const runtime = useRuntime();
  const registration = runtime.resolveComponent(code, domain);

  if (!registration) {
    return <Alert type="error" message={`Component not registered: ${code}`} />;
  }

  const Component = registration.component as ComponentType<Record<string, unknown>>;
  const componentProps = {
    ...props,
    ...bindings,
    ...(registration.adapter === "antd" ? undefined : context),
  };

  return children === undefined
    ? createElement(Component, componentProps)
    : createElement(Component, componentProps, children);
}

interface SchemaComponentProps extends Omit<RuntimeComponentProps, "props"> {
  schemaProps: ValueSource<Record<string, unknown>>;
  scope: ValueSource<Record<string, unknown>>;
}

export function SchemaComponent({ schemaProps, scope, ...props }: SchemaComponentProps) {
  const resolvedProps = useCompiledProps(schemaProps, scope);
  return <RuntimeComponent {...props} props={resolvedProps} />;
}
