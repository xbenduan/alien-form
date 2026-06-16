/**
 * @alien-form/react — Value-capability signal bindings for React
 */

import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  memo,
} from "react";
import type React from "react";
import { effect, signal as createSignal } from "@alien-form/core";
import type {
  Signal,
  Computed,
  FormInstance,
  FormConfig,
  FieldNode,
  PrimitiveFieldNode,
  ArrayFieldNode,
  ObjectFieldNode,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldDisplayTypes,
} from "@alien-form/core";
import { createForm, sortByOrder } from "@alien-form/core";

export { createForm } from "@alien-form/core";
export type {
  Signal,
  Computed,
  FormInstance,
  FormConfig,
  FieldNode,
  PrimitiveFieldNode,
  ObjectFieldNode,
  ArrayFieldNode,
  VoidFieldNode,
  RowNode,
  IFormSchema,
  IFieldSchema,
  FieldError,
  DataSourceItem,
  FieldDisplayTypes,
  ValidateStatus,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  SchemaReactionKey,
  RuntimeRuleHandler,
  RuntimeRuleContext,
  DataSourcePolicy,
  SchemaTypes,
  FormErrorScope,
} from "@alien-form/core";

export function useSignalValue<T>(sig: Signal<T> | Computed<T>): T {
  const subscribe = useCallback((notify: () => void) => {
    return effect(() => { sig(); notify(); });
  }, [sig]);
  const getSnapshot = useCallback(() => sig(), [sig]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * 聚合订阅：把一个字段在渲染中读取的所有 signal 合并为单个 useSyncExternalStore。
 * 一个 effect 追踪 read(field) 读到的全部 signal，任意一个变化即 bump version；
 * getSnapshot 只返回稳定的 version（基元），渲染期直接 untracked 读取最新值
 * （React 渲染期间没有 active subscriber，signal 读取天然不建立依赖）。
 *
 * 相比逐属性 useSignalValue（单字段最多 14 个 effect + 14 个 store），
 * 此处每字段仅 1 个 effect + 1 个 store，大幅降低超大表单的挂载开销与 GC 压力。
 */
function useFieldRender<F extends FieldNode, T>(field: F, read: (field: F) => T): T {
  const versionRef = useRef(0);
  const subscribe = useCallback((notify: () => void) => {
    let mounted = false;
    return effect(() => {
      read(field);
      if (mounted) { versionRef.current++; notify(); }
      else mounted = true;
    });
  }, [field]);
  const getSnapshot = useCallback(() => versionRef.current, []);
  useSyncExternalStore(subscribe, getSnapshot);
  return read(field);
}

function readPrimitive(field: PrimitiveFieldNode) {
  return {
    display: field.display(),
    componentName: field.component(),
    decoratorName: field.decorator(),
    value: field.value(),
    disabled: field.disabled(),
    loading: field.loading(),
    componentProps: field.componentProps(),
    dataSource: field.dataSource(),
    title: field.title(),
    required: field.required(),
    errors: field.errors(),
    warnings: field.warnings(),
    description: field.description(),
    validateStatus: field.validateStatus(),
    decoratorProps: field.decoratorProps(),
  };
}

function readArray(field: ArrayFieldNode) {
  return {
    display: field.display(),
    componentName: field.component(),
    decoratorName: field.decorator(),
    disabled: field.disabled(),
    title: field.title(),
    required: field.required(),
    errors: field.errors(),
    warnings: field.warnings(),
    description: field.description(),
    validateStatus: field.validateStatus(),
    componentProps: field.componentProps(),
    decoratorProps: field.decoratorProps(),
    rowNodes: field.rows(),
  };
}

function readObject(field: ObjectFieldNode) {
  return {
    display: field.display(),
    componentName: field.component(),
    decoratorName: field.decorator(),
    componentProps: field.componentProps(),
    title: field.title(),
    description: field.description(),
    required: field.required(),
    errors: field.errors(),
    decoratorProps: field.decoratorProps(),
  };
}

function readVoid(field: FieldNode) {
  return {
    display: field.display(),
    componentName: field.component(),
    componentProps: field.componentProps(),
    title: field.title(),
    description: field.description(),
  };
}

export type ComponentMap = Record<string, React.ComponentType<any>>;
export type DecoratorMap = Record<string, React.ComponentType<any>>;

interface FormContextValue {
  form: FormInstance;
  components: ComponentMap;
  decorators: DecoratorMap;
}

const FormContext = createContext<FormContextValue | null>(null);
export { FormContext };

export function useCreateForm(
  config: FormConfig = {},
  deps: React.DependencyList = [],
): FormInstance {
  // 重建判断完全交给 useMemo(deps)，ref 不参与“是否重建”，避免历史上
  // “ref 缓存旧 schema 导致校验失效”的问题复现。
  const form = useMemo(() => createForm(config), deps);
  const prevRef = useRef<FormInstance | null>(null);
  useEffect(() => {
    // deps 变化产生新实例时，在此销毁上一个实例（清理 effectDisposers /
    // errorListeners / 整棵字段树）。destroy 必须放在 setup 而非 cleanup：
    // StrictMode 会额外触发一次 cleanup，若在 cleanup 内 destroy 会误杀当前
    // 仍存活的实例；而 setup 内仅销毁 prev !== form 的旧实例，重挂时
    // prev === form 不会误销毁。
    if (prevRef.current && prevRef.current !== form) {
      prevRef.current.destroy();
    }
    prevRef.current = form;
    form.mount();
    return () => {
      form.unmount();
    };
  }, [form]);
  return form;
}

export function useForm(): FormInstance {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("[alien-form] useForm must be inside <FormProvider>");
  return ctx.form;
}

export function useFieldAtoms(path: string): FieldNode | undefined {
  const form = useForm();
  const fields = useSignalValue(form.fields);
  return fields.get(path);
}

export function useFieldValue(path: string): any {
  const field = useFieldAtoms(path);
  // 始终调用 useSignalValue，避免条件调用 Hook 违反 Rules of Hooks。
  // 非 primitive 字段回退到稳定的 undefined signal。
  const sig = field?.kind === "primitive" ? field.value : undefinedSignal;
  return useSignalValue(sig);
}

export function useFieldErrors(path: string): FieldError[] {
  const field = useFieldAtoms(path);
  return useSignalValue(field?.errors ?? emptyArraySignal) as FieldError[];
}

export function useFieldDisplay(path: string): FieldDisplayTypes {
  const field = useFieldAtoms(path);
  return useSignalValue(field?.display ?? visibleSignal) as FieldDisplayTypes;
}

export function useFieldDisabled(path: string): boolean {
  const field = useFieldAtoms(path);
  return useSignalValue(field?.disabled ?? falseSignal);
}

export function useFieldRequired(path: string): boolean {
  const field = useFieldAtoms(path);
  return useSignalValue(field?.required ?? falseSignal);
}

export function useFieldLoading(path: string): boolean {
  const field = useFieldAtoms(path);
  return useSignalValue(field?.loading ?? falseSignal);
}

export function useFormValues(): Record<string, any> {
  const form = useForm();
  return useSignalValue(form.values);
}

export function useFormValid(): boolean {
  const form = useForm();
  return useSignalValue(form.valid);
}

export function useFormSubmitting(): boolean {
  const form = useForm();
  return useSignalValue(form.submitting);
}

export function useFormErrors(): FieldError[] {
  const form = useForm();
  return useSignalValue(form.errors);
}

export function useFormSubmit<T = any>() {
  const form = useForm();
  const submitting = useSignalValue(form.submitting);
  const submit = useCallback((onSubmit?: (values: Record<string, any>) => T | Promise<T>) => form.submit(onSubmit), [form]);
  return { submit, submitting };
}

export function useFormValidate() {
  const form = useForm();
  const validate = useCallback(() => form.validate(), [form]);
  return { validate };
}

interface FormProviderProps {
  form: FormInstance;
  components?: ComponentMap;
  decorators?: DecoratorMap;
  children?: React.ReactNode;
}

export const FormProvider: React.FC<FormProviderProps> = ({ form, components = {}, decorators = {}, children }) => {
  const compRef = useRef(components);
  const decoRef = useRef(decorators);
  compRef.current = components;
  decoRef.current = decorators;
  const value = useMemo(() => ({
    form,
    get components() { return compRef.current; },
    get decorators() { return decoRef.current; },
  }), [form]);
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

export const SchemaField: React.FC<{ schema?: IFormSchema }> = () => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("[alien-form] SchemaField must be inside <FormProvider>");
  return <SchemaProperties schema={ctx.form.schema} parentPath="" />;
};

const SchemaProperties: React.FC<{ schema: IFormSchema | IFieldSchema; parentPath: string }> = ({ schema, parentPath }) => {
  const properties = (schema as any).properties as Record<string, IFieldSchema> | undefined;
  if (!properties) return null;
  return <>{sortByOrder(properties).map(([key, fieldSchema]) => <SchemaFieldItem key={key} fieldKey={key} schema={fieldSchema} parentPath={parentPath} />)}</>;
};

const SchemaFieldItem: React.FC<{ fieldKey: string; schema: IFieldSchema; parentPath: string }> = memo(({ fieldKey, schema, parentPath }) => {
  const fullPath = parentPath ? `${parentPath}.${fieldKey}` : fieldKey;
  if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) return <ArrayFieldSlot path={fullPath} schema={schema} />;
  if (schema.type === "object" && schema.properties) return schema.component ? <ObjectFieldSlot path={fullPath} schema={schema} /> : <SchemaProperties schema={schema} parentPath={fullPath} />;
  if (schema.type === "void") return <VoidFieldSlot path={fullPath} schema={schema} parentPath={parentPath} />;
  return <PrimitiveFieldSlot path={fullPath} />;
});

const PrimitiveFieldSlot: React.FC<{ path: string }> = memo(({ path }) => {
  const ctx = useContext(FormContext)!;
  const field = useSignalValue(ctx.form.fields).get(path);
  if (!field || field.kind !== "primitive") return null;
  return <PrimitiveFieldSlotInner field={field} />;
});

const PrimitiveFieldSlotInner: React.FC<{ field: PrimitiveFieldNode }> = memo(({ field }) => {
  const ctx = useContext(FormContext)!;
  const { components, decorators } = ctx;
  const {
    display, componentName, decoratorName, value, disabled, loading,
    componentProps, dataSource, title, required, errors, warnings,
    description, validateStatus, decoratorProps,
  } = useFieldRender(field, readPrimitive);
  const onChange = useCallback((v: any) => field.setValue(v), [field]);
  if (display === "none") return null;
  if (display === "hidden") return <div style={{ display: "none" }} />;
  const Component = components[componentName];
  const Decorator = decorators[decoratorName];
  if (!Component) return <div style={{ color: "red" }}>{`Unknown: ${componentName}`}</div>;
  const props: Record<string, any> = {
    ...componentProps,
    value,
    onChange,
    disabled,
    loading,
  };
  if (dataSource.length > 0) props.dataSource = dataSource;
  const rendered = <Component {...props} />;
  return Decorator ? <Decorator label={title} required={required} errors={errors} warnings={warnings} description={description} validateStatus={validateStatus} {...decoratorProps}>{rendered}</Decorator> : rendered;
});

const ArrayFieldSlot: React.FC<{ path: string; schema: IFieldSchema }> = memo(({ path, schema }) => {
  const ctx = useContext(FormContext)!;
  const field = useSignalValue(ctx.form.fields).get(path);
  if (!field || field.kind !== "array") return null;
  return <ArrayFieldSlotInner field={field} schema={schema} />;
});

const ArrayFieldSlotInner: React.FC<{ field: ArrayFieldNode; schema: IFieldSchema }> = memo(({ field, schema }) => {
  const ctx = useContext(FormContext)!;
  const { components, decorators } = ctx;
  const {
    display, componentName, decoratorName, disabled, title, required,
    errors, warnings, description, validateStatus, componentProps,
    decoratorProps, rowNodes,
  } = useFieldRender(field, readArray);
  const componentDisabled = Boolean((componentProps as Record<string, any> | undefined)?.disabled);
  if (display === "none") return null;
  if (display === "hidden") return <div style={{ display: "none" }} />;
  const ArrayComponent = components[componentName];
  const Decorator = decorators[decoratorName];
  const itemSchema = schema.items as IFieldSchema;
  const rows: React.ReactNode[][] = [];
  const rowFields: Record<string, React.ReactNode>[] = [];
  for (const row of rowNodes) {
    const children: React.ReactNode[] = [];
    const fieldMap: Record<string, React.ReactNode> = {};
    if (itemSchema.properties) {
      for (const [childKey, childSchema] of sortByOrder(itemSchema.properties)) {
        const node = renderRowChild(row.path, childKey, childSchema);
        children.push(node);
        fieldMap[childKey] = node;
      }
    }
    rows.push(children);
    rowFields.push(fieldMap);
  }
  const arrayProps = {
    ...componentProps,
    field,
    rows,
    rowNodes,
    rowFields,
    onAdd: (iv?: Record<string, any>) => field.push(iv),
    onRemove: (i: number) => field.remove(i),
    onMoveUp: (i: number) => field.moveUp(i),
    onMoveDown: (i: number) => field.moveDown(i),
    onMove: (from: number, to: number) => field.move(from, to),
    disabled: disabled || componentDisabled,
  };
  const decoProps = { label: title, required, errors, warnings, description, validateStatus, ...decoratorProps };
  if (ArrayComponent) {
    const rendered = <ArrayComponent {...arrayProps} />;
    return Decorator ? <Decorator {...decoProps}>{rendered}</Decorator> : rendered;
  }
  return <div>{rows.map((row, i) => <div key={rowNodes[i]?.id || i}>{row}</div>)}{!disabled && <button type="button" onClick={() => field.push()}>+ Add</button>}</div>;
});

function renderRowChild(rowPath: string, childKey: string, childSchema: IFieldSchema): React.ReactNode {
  const path = `${rowPath}.${childKey}`;
  if (childSchema.type === "array" && childSchema.items && !Array.isArray(childSchema.items)) return <ArrayFieldSlot key={childKey} path={path} schema={childSchema} />;
  if (childSchema.type === "object" && childSchema.properties) return childSchema.component ? <ObjectFieldSlot key={childKey} path={path} schema={childSchema} /> : <SchemaProperties key={childKey} schema={childSchema} parentPath={path} />;
  if (childSchema.type === "void") return <VoidFieldSlot key={childKey} path={path} schema={childSchema} parentPath={rowPath} />;
  return <PrimitiveFieldSlot key={childKey} path={path} />;
}

const ObjectFieldSlot: React.FC<{ path: string; schema: IFieldSchema }> = memo(({ path, schema }) => {
  const ctx = useContext(FormContext)!;
  const field = useSignalValue(ctx.form.fields).get(path);
  if (!field || field.kind !== "object") return null;
  return <ObjectFieldSlotInner field={field} schema={schema} />;
});

const ObjectFieldSlotInner: React.FC<{ field: ObjectFieldNode; schema: IFieldSchema }> = memo(({ field, schema }) => {
  const ctx = useContext(FormContext)!;
  const { components, decorators } = ctx;
  const {
    display, componentName, decoratorName, componentProps, title,
    description, required, errors, decoratorProps,
  } = useFieldRender(field, readObject);
  if (display === "none") return null;
  if (display === "hidden") return <div style={{ display: "none" }} />;
  const ObjectComponent = components[componentName];
  const Decorator = decorators[decoratorName];
  const sorted = schema.properties ? sortByOrder(schema.properties) : [];
  const children = sorted.map(([k, s]) => <SchemaFieldItem key={k} fieldKey={k} schema={s} parentPath={field.path} />);
  const fieldMap: Record<string, React.ReactNode> = {};
  for (const [k, s] of sorted) fieldMap[k] = renderRowChild(field.path, k, s);
  if (ObjectComponent) {
    const rendered = <ObjectComponent {...componentProps} field={field} fields={fieldMap} title={title} description={description}>{children}</ObjectComponent>;
    return Decorator ? <Decorator label={title} required={required} errors={errors} {...decoratorProps}>{rendered}</Decorator> : rendered;
  }
  return <>{children}</>;
});

const VoidFieldSlot: React.FC<{ path: string; schema: IFieldSchema; parentPath: string }> = memo(({ path, schema, parentPath }) => {
  const ctx = useContext(FormContext)!;
  const field = useSignalValue(ctx.form.fields).get(path);
  if (field && field.kind === "void") return <VoidFieldSlotInner field={field} schema={schema} />;
  const sorted = schema.properties ? sortByOrder(schema.properties) : [];
  return <>{sorted.map(([k, s]) => <SchemaFieldItem key={k} fieldKey={k} schema={s} parentPath={parentPath} />)}</>;
});

const VoidFieldSlotInner: React.FC<{ field: FieldNode; schema: IFieldSchema }> = memo(({ field, schema }) => {
  const ctx = useContext(FormContext)!;
  const { components } = ctx;
  const { display, componentName, componentProps, title, description } = useFieldRender(field, readVoid);
  if (display === "none") return null;
  if (display === "hidden") return <div style={{ display: "none" }} />;
  const sorted = schema.properties ? sortByOrder(schema.properties) : [];
  const parentPath = field.path.includes(".") ? field.path.slice(0, field.path.lastIndexOf(".")) : "";
  const children = sorted.map(([k, s]) => <SchemaFieldItem key={k} fieldKey={k} schema={s} parentPath={parentPath} />);
  const Layout = components[componentName];
  return Layout ? <Layout title={title} description={description} {...componentProps}>{children}</Layout> : <>{children}</>;
});

const emptyArraySignal = createSignal([]);
const visibleSignal = createSignal("visible" as FieldDisplayTypes);
const falseSignal = createSignal(false);
const undefinedSignal = createSignal<any>(undefined);
