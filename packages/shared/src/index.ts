// 类型
export type {
  ComponentMeta,
  ComponentOption,
  ComponentRegistry,
  ComponentRegistryEntry,
  FieldComponentProps,
  FieldKind,
  FieldMode,
  FieldSchema,
  GroupConfig,
  LeafField,
  RegistryFieldSchema,
  SchemaConfig,
  SchemaRecord,
  TableColumn,
} from "./types";
export type { IFieldSchema, IFormSchema, DataSourceItem } from "@alien-form/react";

// compiler：schema 全流程统一中心（编译投影 / 插件 / 描述符 / 编辑态）
export {
  SchemaCompiler,
  createSchemaCompiler,
  defaultDescriptors,
  matchDescriptor,
  builtinPlugins,
  dataSourcePlugin,
  constantPlugin,
  i18nPlugin,
  DATA_SOURCE_PLUGIN,
  CONSTANT_PLUGIN,
  I18N_PLUGIN,
  projectColumns,
  projectField,
  projectFilter,
  projectForm,
  prefetch,
  resolveScene,
  createEmptyDraft,
  createFieldDraft,
  createGroupDraft,
  createIdFactory,
  DEFAULT_LAYOUT,
  draftToSchema,
  schemaToDraft,
  isPluginMarker,
  collectLeafFields,
  EMPTY_TEXT,
  getChildProperties,
  isComplexField,
  isEmptyValue,
  optionLabel,
  statusColor,
  toDisplayText,
  multiValueFormat,
  parseMultiValue,
  serializeMultiValue,
  collectMarkers,
  deletePath,
  getPath,
  setPath,
} from "./compiler";
export type {
  AlienPlugin,
  AfUiNode,
  Compiled,
  CompileOptions,
  ConstantResolver,
  DescriptorCtx,
  FieldDescriptor,
  FieldDraft,
  FieldService,
  FoundMarker,
  GroupDraft,
  I18nDict,
  Locale,
  ModelDraft,
  ModelFieldSchema,
  ModelGroup,
  ModelMeta,
  ModelSchema,
  OpenMode,
  PluginMarker,
  PrefetchCtx,
  RequestFn,
  RequestInput,
  RequestResult,
  ServiceClient,
  ServiceResolver,
  ResolveCtx,
  Scene,
  SchemaCompilerContext,
  TableFieldMeta,
  XDatabaseMeta,
} from "./compiler";

// components：符合 alien-form 协议的组件注册机与渲染核心
export {
  buildComponentOptions,
  componentMeta,
  componentRegistry,
  DisplayValue,
  FieldDetailModal,
  FieldModeScope,
  fieldComponents,
  fieldDecorators,
  FilterItem,
  FormItem,
  getComponentMeta,
  getDefaultFieldSchema,
  getRegistryEntry,
  isComplexComponent,
  isContainerComponent,
  isMultiValueComponent,
  LAYOUT_COMPONENTS,
  SchemaRenderer,
  RuntimeResourceContext,
  FieldServiceContext,
  useAsyncOptions,
  useFieldMode,
  useFieldOptions,
  useServiceResolver,
} from "./components";
export type {
  DisplayValueProps,
  FieldDetailModalProps,
  RuntimeResourceContextValue,
  SchemaRendererProps,
} from "./components";

// form
export { DrawerSchemaForm, ModalSchemaForm, PageSchemaForm, SchemaForm } from "./form";
export type { SchemaFormProps, SchemaFormRef } from "./form";

// table
export { Table } from "./table";
export type { TableColumnAction, TableComponentProps } from "./table";

// filter
export { FilterForm } from "./filter";
export type { FilterFormProps } from "./filter";
