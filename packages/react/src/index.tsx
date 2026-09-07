/**
 * @alien-form/react — React bindings for the core and compiled engine protocols.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
  type DependencyList,
} from "react";
import type {
  FieldNode,
  FormInstance,
  FormConfig,
  RowNode,
  Signal,
  Computed,
} from "@alien-form/core";
import { createForm, effect, signal as createSignal } from "@alien-form/core";
import {
  containsCompiledValue,
  evaluateCompiledValue,
  type CompiledNode,
  type PageRuntime,
  type Runtime,
} from "@alien-form/engine";

export { createForm } from "@alien-form/core";
export type {
  Signal,
  Computed,
  FormInstance,
  FormConfig,
  FieldNode,
  ArrayFieldNode,
  RowNode,
  FieldError,
  FieldDisplayTypes,
  DataSourceItem,
  ValidateStatus,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  SchemaReactionKey,
  RuntimeRuleContext,
  ExpressionScope,
  SchemaTypes,
  FormErrorScope,
} from "@alien-form/core";
export type { CompiledNode, PageRuntime, Runtime } from "@alien-form/engine";

export type EqualityFn<T> = (previous: T, next: T) => boolean;
export type ValueSource<T> = T | (() => T);

export function shallowEqual<T>(previous: T, next: T): boolean {
  if (Object.is(previous, next)) return true;
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") {
    return false;
  }
  const previousRecord = previous as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  const previousKeys = Object.keys(previousRecord);
  const nextKeys = Object.keys(nextRecord);
  if (previousKeys.length !== nextKeys.length) return false;
  return previousKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(nextRecord, key) &&
      Object.is(previousRecord[key], nextRecord[key]),
  );
}

export function useSignalValue<T>(sig: Signal<T> | Computed<T>): T {
  const subscribe = useCallback(
    (notify: () => void) =>
      effect(() => {
        sig();
        notify();
      }),
    [sig],
  );
  const getSnapshot = useCallback(() => sig(), [sig]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSignalSnapshot<T>(read: () => T, isEqual: EqualityFn<T> = Object.is): T {
  const snapshotRef = useRef<{ read: () => T; value: T; version: number } | undefined>(undefined);
  if (!snapshotRef.current || snapshotRef.current.read !== read) {
    const value = read();
    const previous = snapshotRef.current;
    snapshotRef.current = {
      read,
      value: previous && isEqual(previous.value, value) ? previous.value : value,
      version: (previous?.version ?? 0) + 1,
    };
  }

  const subscribe = useCallback(
    (notify: () => void) =>
      effect(() => {
        const next = read();
        const current = snapshotRef.current!;
        if (current.read !== read || isEqual(current.value, next)) return;
        snapshotRef.current = { read, value: next, version: current.version + 1 };
        notify();
      }),
    [isEqual, read],
  );
  const getSnapshot = useCallback(() => snapshotRef.current!.version, []);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snapshotRef.current.value;
}

export function useFieldSnapshot<F extends FieldNode, T>(
  field: F,
  read: (field: F) => T,
  isEqual: EqualityFn<T> = shallowEqual,
): T {
  const readSnapshot = useCallback(() => read(field), [field, read]);
  return useSignalSnapshot(readSnapshot, isEqual);
}

export function useCreateForm(config: FormConfig = {}, deps: DependencyList = []): FormInstance {
  const form = useMemo(() => createForm(config), deps);
  const previous = useRef<FormInstance | undefined>(undefined);
  useEffect(() => {
    if (previous.current && previous.current !== form) previous.current.destroy();
    previous.current = form;
    form.mount();
    return () => form.unmount();
  }, [form]);
  return form;
}

export function useRegisterField(form: FormInstance, field: FieldNode): void {
  useEffect(() => {
    form._registerField(field);
    return () => form._unregisterField(field);
  }, [form, field]);
}

export function useForm(): FormInstance {
  const form = useContext(FormContext)?.form;
  if (!form) throw new Error("[alien-form] useForm must be inside <FormProvider>");
  return form;
}

export function useFormScope<T extends Record<string, unknown> = Record<string, unknown>>(): T {
  return useForm().scope as T;
}

export function useFieldAtoms(path: string): FieldNode | undefined {
  const form = useForm();
  return useSignalValue(form.fields).get(path);
}

export function useFieldValue(path: string): unknown {
  const field = useFieldAtoms(path);
  return useSignalValue(field?.kind === "primitive" ? field.value : undefinedSignal);
}

export interface ComponentProps {
  form: FormInstance;
  field: FieldNode;
  node: CompiledNode;
  slots: Record<string, ReactNode>;
  children?: ReactNode;
  value?: unknown;
  mode?: string;
  domain?: string;
  onChange?: (value: unknown) => void;
  isFilter?: boolean;
  dataSource?: unknown[];
  loading?: boolean;
  placeholder?: string;
  renderRow?: (row: RowNode) => ReactNode;
  [key: string]: unknown;
}

interface FormContextValue {
  form: FormInstance;
}

const FormContext = createContext<FormContextValue | null>(null);
const RuntimeContext = createContext<Runtime | null>(null);
const PageContext = createContext<PageRuntime | null>(null);
const lifecycleVersions = new WeakMap<PageRuntime, number>();
const undefinedSignal = createSignal<unknown>(undefined);

export function FormProvider({ form, children }: PropsWithChildren<{ form: FormInstance }>) {
  return <FormContext.Provider value={{ form }}>{children}</FormContext.Provider>;
}

export function RuntimeProvider({ runtime, children }: PropsWithChildren<{ runtime: Runtime }>) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("RuntimeProvider is missing");
  return runtime;
}

export function PageProvider({ page, children }: PropsWithChildren<{ page: PageRuntime }>) {
  useEffect(() => {
    const version = (lifecycleVersions.get(page) ?? 0) + 1;
    lifecycleVersions.set(page, version);
    page.mount();
    return () => {
      page.form.unmount();
      queueMicrotask(() => {
        if (lifecycleVersions.get(page) !== version) return;
        lifecycleVersions.delete(page);
        page.destroy();
      });
    };
  }, [page]);
  return <PageContext.Provider value={page}>{children}</PageContext.Provider>;
}

export function usePage(): PageRuntime {
  const page = useContext(PageContext);
  if (!page) throw new Error("PageProvider is missing");
  return page;
}

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
  context?: Record<string, unknown>;
  children?: ReactNode;
}

export function RuntimeComponent({
  code,
  domain,
  props = {},
  context,
  children,
}: RuntimeComponentProps) {
  const runtime = useRuntime();
  const registration = runtime.resolveComponent(code, domain);
  if (!registration) throw new Error(`Component "${code}" 未注册`);
  const Component = registration.component as ComponentType<Record<string, unknown>>;
  const componentProps = registration.adapter === "antd" ? props : { ...props, ...context };
  return children === undefined
    ? createElement(Component, componentProps)
    : createElement(Component, componentProps, children);
}

interface SchemaComponentProps extends Omit<RuntimeComponentProps, "props"> {
  schemaProps: ValueSource<Record<string, unknown>>;
  scope: ValueSource<Record<string, unknown>>;
  controlProps?: Record<string, unknown>;
}

export function SchemaComponent({
  schemaProps,
  scope,
  controlProps,
  ...props
}: SchemaComponentProps) {
  return (
    <RuntimeComponent
      {...props}
      props={{ ...useCompiledProps(schemaProps, scope), ...controlProps }}
    />
  );
}

function rowValues(form: FormInstance, field: FieldNode): Record<string, unknown> | undefined {
  if (!field.row) return undefined;
  return Object.fromEntries(
    Array.from(field.row.children, ([key, child]) => [key, form.project(child.path)]),
  );
}

function childField(field: FieldNode, key: string): FieldNode {
  if (field.kind !== "object" && field.kind !== "void") {
    throw new Error(`Field cannot contain compiled children: ${field.path}`);
  }
  const child = field.children.get(key);
  if (!child) throw new Error(`Compiled child field not found: ${field.path}.${key}`);
  return child;
}

function readFieldSnapshot(field: FieldNode) {
  return {
    display: field.display(),
    componentCode: field.component(),
    decoratorCode: field.decorator(),
    decoratorProps: field.decoratorProps(),
    errors: field.errors(),
    warnings: field.warnings(),
    validateStatus: field.validateStatus(),
    disabled: field.disabled(),
    required: field.required(),
    title: field.title(),
    description: field.description(),
    loading: field.loading(),
    dataSource: field.dataSource(),
    value: field.kind === "primitive" ? field.value() : undefined,
  };
}

function useNodeProps(node: CompiledNode, field: FieldNode, form: FormInstance) {
  const props = useCallback(() => {
    const fieldProps = field.componentProps();
    return Object.fromEntries(
      Array.from(new Set([...Object.keys(node.props), ...Object.keys(fieldProps)])).map((key) => [
        key,
        fieldProps[key] === node.schema.props?.[key] ? node.props[key] : fieldProps[key],
      ]),
    );
  }, [field, node]);
  const scope = useCallback(() => {
    const value = field.kind === "primitive" ? field.value() : form.project(field.path);
    return {
      ...form.scope,
      $values: form.values(),
      $self: field,
      $form: form,
      $value: value,
      $row: rowValues(form, field),
      $path: field.path,
    };
  }, [field, form]);
  return useCompiledProps(props, scope);
}

function RenderField({
  node,
  field,
  form,
  domain,
}: {
  node: CompiledNode;
  field: FieldNode;
  form: FormInstance;
  domain?: string;
}): React.ReactElement | null {
  const snapshot = useFieldSnapshot(field, readFieldSnapshot);
  const props = useNodeProps(node, field, form);
  useRegisterField(form, field);
  if (snapshot.display === "none") return null;

  const slotted = new Set<CompiledNode>();
  const slots = Object.fromEntries(
    Object.entries(node.slots).map(([name, slot]) => {
      const nodes = Array.isArray(slot) ? slot : [slot];
      nodes.forEach((child) => slotted.add(child));
      return [
        name,
        nodes.map((child) => {
          const target = childField(field, child.key);
          return (
            <RenderField key={target.id} node={child} field={target} form={form} domain={domain} />
          );
        }),
      ];
    }),
  );
  const children = node.children
    .filter((child) => !slotted.has(child))
    .map((child) => {
      const target = childField(field, child.key);
      return (
        <RenderField key={target.id} node={child} field={target} form={form} domain={domain} />
      );
    });
  const renderRow =
    field.kind === "array" && node.items
      ? (row: RowNode) => (
          <FieldNodes
            nodes={node.items!.children}
            fields={row.children}
            form={form}
            domain={domain}
          />
        )
      : undefined;
  const controlProps =
    field.kind === "primitive"
      ? {
          ...props,
          id: props.id ?? field.id,
          value: snapshot.value,
          onChange: field.setValue,
          disabled: snapshot.disabled,
          loading: snapshot.loading,
          dataSource: snapshot.dataSource,
          "aria-invalid": snapshot.errors.length > 0,
          "aria-describedby": snapshot.errors.length ? `${field.id}-error` : undefined,
        }
      : props;
  const context = {
    form,
    field,
    node,
    slots,
    mode: typeof form.scope.mode === "string" ? form.scope.mode : undefined,
    domain,
    value: snapshot.value,
    title: snapshot.title,
    description: snapshot.description,
    renderRow,
  };
  const control = (
    <RuntimeComponent
      code={snapshot.componentCode}
      domain={domain}
      props={controlProps}
      context={context}
    >
      {children.length ? children : undefined}
    </RuntimeComponent>
  );
  if (field.kind !== "primitive") return control;

  const decorated = (
    <RuntimeComponent
      code={snapshot.decoratorCode}
      domain={domain}
      props={{
        ...snapshot.decoratorProps,
        title: snapshot.title,
        required: snapshot.required && context.mode !== "detail",
        errors: snapshot.errors,
        warnings: snapshot.warnings,
        description: snapshot.description,
        validateStatus: snapshot.validateStatus,
        gridSpan: props.gridSpan,
      }}
      context={{ form, field, node, domain, mode: context.mode }}
    >
      {control}
    </RuntimeComponent>
  );
  return snapshot.display === "hidden" ? <div hidden>{decorated}</div> : decorated;
}

export function FieldNodes({
  nodes,
  fields,
  form,
  domain,
}: {
  nodes: CompiledNode[];
  fields: ReadonlyMap<string, FieldNode>;
  form: FormInstance;
  domain?: string;
}) {
  return nodes.map((node) => {
    const field = fields.get(node.key);
    if (!field) throw new Error(`Compiled field not found: ${node.key}`);
    return <RenderField key={field.id} node={node} field={field} form={form} domain={domain} />;
  });
}

export function FormRenderer({
  form,
  nodes,
  domain,
}: {
  form: FormInstance;
  nodes: CompiledNode[];
  domain?: string;
}) {
  return (
    <FormProvider form={form}>
      <div data-alien-form>
        <FieldNodes nodes={nodes} fields={form.root.children} form={form} domain={domain} />
      </div>
    </FormProvider>
  );
}
