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
  SchemaHandlers,
  SchemaRecord,
  TableColumn,
} from "./types";

// utils：form / table / filter 共有的函数逻辑
export {
  buildFilterSchema,
  buildFormSchema,
  buildTableColumns,
  collectLeafFields,
  EMPTY_TEXT,
  getChildProperties,
  isComplexField,
  isEmptyValue,
  multiValueFormat,
  optionLabel,
  parseMultiValue,
  serializeMultiValue,
  statusColor,
  toDisplayText,
  transformFieldForForm,
} from "./utils";

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
  useFieldMode,
} from "./components";
export type {
  DisplayValueProps,
  FieldDetailModalProps,
  SchemaRendererProps,
} from "./components";

// form
export {
  DrawerSchemaForm,
  ModalSchemaForm,
  PageSchemaForm,
  SchemaForm,
  useFormSchema,
} from "./form";
export type { SchemaFormProps, SchemaFormRef } from "./form";

// table
export { Table, useColumns } from "./table";
export type { TableColumnAction, TableComponentProps } from "./table";

// filter
export { FilterForm, useFilterFields } from "./filter";
export type { FilterFields, FilterFormProps } from "./filter";
