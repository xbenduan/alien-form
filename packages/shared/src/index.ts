// 类型
export type {
  ComponentMeta,
  FieldComponentProps,
  FieldKind,
  FieldMode,
  FieldSchema,
  GroupConfig,
  LeafField,
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
  componentMeta,
  EMPTY_TEXT,
  getChildProperties,
  getComponentMeta,
  isComplexComponent,
  isComplexField,
  isEmptyValue,
  isMultiValueComponent,
  LAYOUT_COMPONENTS,
  multiValueFormat,
  optionLabel,
  parseMultiValue,
  serializeMultiValue,
  statusColor,
  toDisplayText,
  transformFieldForForm,
} from "./utils";

// components：符合 alien-form 协议的所有组件
export {
  ArrayCards,
  CheckboxGroup,
  DateInput,
  DisplayValue,
  FieldDetailModal,
  FieldModeScope,
  fieldComponents,
  fieldDecorators,
  FilterItem,
  FormItem,
  GridLayout,
  Input,
  MultiSelect,
  NumberInput,
  ObjectField,
  Radio,
  Rate,
  SchemaRenderer,
  Select,
  Switch,
  TagsInput,
  Textarea,
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
export type { SchemaFormProps } from "./form";

// table
export { Table, useColumns } from "./table";
export type { TableColumnAction, TableComponentProps } from "./table";

// filter
export { FilterForm, useFilterFields } from "./filter";
export type { FilterFields, FilterFormProps } from "./filter";
