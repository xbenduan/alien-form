import type { FieldMapping, FormworkUI } from "formwork";

const all = (component: string): FieldMapping => ({
  form: { component },
  filter: { component },
  table: { component },
  detail: { component },
});

/** 声明应用视觉映射，Schema 可按场景覆盖组件和 props。 */
export const ui: FormworkUI = {
  shell: "Shell",
  fieldContainer: "FormItem",
  types: {
    string: all("Input"),
    number: all("NumberInput"),
    integer: all("NumberInput"),
    boolean: all("Boolean"),
    null: all("Null"),
    object: all("ObjectFields"),
    array: all("ArrayFields"),
  },
  formats: {
    richtext: all("Text"),
    strings: all("Select"),
    numbers: all("Select"),
    booleans: all("Select"),
  },
  selectField: ({ field }) =>
    field.enum || field.relation || field.items?.enum ? { component: "Select" } : undefined,
  records: {
    layout: "ListLayout",
    filter: "ListFilters",
    actions: "ListActions",
    table: "ListTable",
    pagination: "ListPagination",
  },
  detail: { layout: "DetailLayout" },
  editor: { layout: "EditorLayout" },
  presenters: { page: "PagePresenter", modal: "ModalPresenter", drawer: "DrawerPresenter" },
  feedback: { loading: "Loading", empty: "Empty", error: "Failure", confirm: "Confirmation" },
};
