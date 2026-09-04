/**
 * Alien-Form 页面协议。本文件是唯一的编写契约（canonical authoring contract）。
 *
 * 一个模型（BuilderSchema）由四段构成，作者按此顺序编写：
 *   1. meta                        —— 模型基础信息（名称、标题、分页）。
 *   2. fields                       —— 物理表定义，唯一的存储真相源；后端只解释这一段。
 *   3. definitions['form-schema']   —— 前端表单描述（component / props / 分组 / 联动）。
 *   4. pages                        —— 页面装配（list / add / edit，也可扩展其他页）。
 *
 * 派生关系：
 *   fields ──(存储真相)──▶ 后端建表 / CRUD
 *   fields + form-schema ─▶ filter、table（列/筛选器遍历 fields，component/props 从 form-schema 按 key 取）
 *   form-schema ─────────▶ record-form（新增 / 编辑 / 详情表单）
 *
 * 约束 form-schema ⊇ fields：
 *   - form-schema.properties 必须覆盖 fields 中的每一个 key（每个物理字段都要有表现描述）。
 *   - form-schema 可额外包含不落库的纯展示元素（type: "void"，如顶部提示条、说明文案）。
 *   - 是否存储完全由 fields 决定，与 form-schema 无关；form-schema 只作用于前端表单的渲染。
 *   - fields 用数组而非 map：字段数量有限（超百列即巨石表，应拆分），顺序（列序/表单序）比查找性能更重要。
 *
 * 系统字段（id / status / createdAt / updatedAt 等每个表都有的内置字段）：
 *   - 必须显式出现在 fields 中，并标记 system: true。
 *   - 必须显式出现在 form-schema 中（作者可定制其 component / props / 分组）。
 *   - 渲染层依据 fields 中的 system: true 禁止用户在构建器里编辑/删除这些字段的存储定义；
 *     它们在 record-form 中的可编辑性由各自的 form-schema 描述（如系统时间戳设为 readonly）。
 *
 * 表格列（table）：
 *   - 列集合、初始可见性与筛选能力都由 fields 决定：table 遍历 fields 生成列，初始可见性取自
 *     field.visible，是否可筛选取自 field.filterable。
 *   - visible 是模型声明的静态初始值，未声明时默认为 true；不接受表达式。
 *   - 前端按模型维度缓存用户调整后的 visible、width、fixed：用户可拖动列宽、勾选可见列、设置固定列；
 *     本地缓存存在时覆盖 fields.visible，没有缓存时使用 fields.visible。
 *
 * 打开方式（openMode）："page" | "modal" | "drawer"，声明在触发它的按钮 props 上（如 add/edit/detail
 *   按钮），而不在 meta；page 新开页面，modal/drawer 在当前页渲染对应的 record-form。
 */

export type Expr = `{{${string}}}`;
export type Ref = { $ref: string };
export type PropValue =
  | string
  | number
  | boolean
  | null
  | Ref
  | PropValue[]
  | { [key: string]: PropValue };

export interface FieldGroup {
  /** 分组容器组件，如 ObjectField。 */
  component?: string;
  /** 分组包含的字段 key，按顺序渲染。 */
  keys: string[];
  title?: string;
  description?: string;
  props?: Record<string, PropValue>;
}

export interface FieldSchema {
  type?: "string" | "number" | "boolean" | "object" | "array" | "void";
  title?: string;
  description?: string;
  /** 渲染组件名，从注册中心按名取用。 */
  component?: string;
  required?: boolean;
  /** 表单显隐，仅影响前端表单渲染，与存储和 table 列可见性无关。 */
  display?: "hidden" | "none" | Expr;
  default?: PropValue;
  /** 透传给组件的 props，可含表达式。 */
  props?: Record<string, PropValue>;
  /** 对象字段的子字段描述。 */
  properties?: Record<string, FieldSchema>;
  /** 数组字段的元素描述。 */
  items?: FieldSchema;
  /** 表单分组（仅用于 form-schema 根节点或对象字段）。 */
  group?: FieldGroup[];
  /** 引用 definitions 中的其他 schema。 */
  $ref?: string;
  /** 选项数据源，可为静态数组或表达式。 */
  dataSource?: PropValue | Expr;
  /** 字段联动：依据 $values 等作用域响应式计算属性。 */
  "x-reaction"?: Record<string, PropValue | Expr>;
  /** 值的输入/输出格式转换。 */
  "x-format"?: {
    input?: Expr;
    output?: Expr;
  };
}

export type DatabaseColumnType = "text" | "integer" | "real" | "boolean" | "json";
export type DatabaseValueType = "string" | "number" | "boolean" | "object" | "array";
export type DatabaseRelationKind = "many-to-one" | "many-to-many";
export interface DatabaseRelation {
  kind: DatabaseRelationKind;
  target: string;
  through?: string;
  valueField?: string;
  labelField?: string;
}

/** 物理表字段（存储真相源）。后端建表、CRUD、关系查询只解释这一段。 */
export interface DatabaseField {
  /** 字段键名，同时作为默认列名与 form-schema 的对应 key。 */
  key: string;
  title?: string;
  /** 物理列名，缺省时用 key。 */
  column?: string;
  /** 物理存储类型（映射到 SQLite）。 */
  type: DatabaseColumnType;
  /** 应用层值类型；json 列可为 object / array。 */
  valueType?: DatabaseValueType;
  /** 系统字段：id / status / createdAt / updatedAt 等内置字段，显式声明但禁止用户在构建器中编辑/删除其存储定义。 */
  system?: boolean;
  nullable?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  index?: boolean;
  /** table 列的静态初始可见性，默认为 true；用户本地缓存可覆盖该值。 */
  visible?: boolean;
  /** 是否可作为筛选条件。table 的列筛选与 filter 均取自这里。 */
  filterable?: boolean;
  sortable?: boolean;
  relation?: DatabaseRelation;
}

export interface BuilderMeta {
  /** 模型标识（物理表名），全局唯一。 */
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  /** 用于树/首页分组归类。 */
  group?: string;
  singularLabel?: string;
  pluralLabel?: string;
  defaultPageSize?: number;
}

export interface XPage {
  /** 页面路由片段，如 list / add / edit。 */
  router: string;
  title?: string;
  layout?: {
    component: string;
    props?: Record<string, PropValue>;
  };
  properties: Record<string, FieldSchema>;
}

export interface BuilderSchema {
  meta: BuilderMeta;
  fields: DatabaseField[];
  definitions: {
    "form-schema": FieldSchema;
    [key: string]: FieldSchema;
  };
  pages: XPage[];
}

// ---------------------------------------------------------------------------
// 示例：当前项目的用户表 _sys_user（系统登录账号管理）。
// 落库列：id、username、passwordHash、nickname、remark、addressInfo、
// studentRecords、createBy、createdAt、updatedAt。
// 其中 id / createdAt / updatedAt 为系统字段（system: true）。
// ---------------------------------------------------------------------------
export const _sys_user: BuilderSchema = {
  meta: {
    name: "_sys_user",
    title: "用户管理",
    subtitle: "System Users",
    description: "系统登录账号管理。",
    group: "system",
    singularLabel: "用户",
    pluralLabel: "用户",
    defaultPageSize: 20,
  },
  fields: [
    { key: "id", title: "ID", type: "text", system: true, filterable: true },
    {
      key: "username",
      title: "账号",
      type: "text",
      nullable: false,
      unique: true,
      index: true,
      filterable: true,
    },
    { key: "passwordHash", title: "密码", type: "text", visible: false },
    {
      key: "nickname",
      title: "昵称",
      type: "text",
      nullable: false,
      index: true,
      filterable: true,
    },
    { key: "remark", title: "备注", type: "text", visible: false },
    { key: "addressInfo", title: "住址信息", type: "json", valueType: "object" },
    { key: "studentRecords", title: "学籍信息", type: "json", valueType: "array" },
    { key: "createBy", title: "创建者", type: "text", default: "_sys_admin", filterable: true },
    {
      key: "createdAt",
      title: "创建时间",
      type: "integer",
      valueType: "string",
      system: true,
      filterable: true,
    },
    {
      key: "updatedAt",
      title: "更新时间",
      type: "integer",
      valueType: "string",
      system: true,
      filterable: true,
    },
  ],
  definitions: {
    "form-schema": {
      type: "object",
      properties: {
        // 系统字段：显式出现，渲染层禁止编辑/删除其存储定义；此处仅描述表现。
        id: { type: "string", title: "ID", display: "hidden" },
        username: {
          type: "string",
          title: "账号",
          component: "Input",
          required: true,
          props: { placeholder: "请输入登录账号" },
        },
        // display "none"：不进表单也不提交；仅后端写入。
        passwordHash: { type: "string", title: "密码", component: "Input", display: "none" },
        nickname: {
          type: "string",
          title: "昵称",
          component: "Input",
          required: true,
          props: { placeholder: "请输入昵称" },
        },
        remark: {
          type: "string",
          title: "备注",
          component: "TextArea",
          props: { rows: 3 },
        },
        addressInfo: {
          type: "object",
          title: "住址信息",
          component: "ObjectField",
          props: { gridSpan: 12 },
          properties: {
            nativePlace: {
              type: "string",
              title: "籍贯",
              component: "Input",
              props: { placeholder: "请输入籍贯" },
            },
            currentAddress: {
              type: "string",
              title: "现住址",
              component: "Input",
              props: { placeholder: "请输入现住址" },
            },
            idCardAddress: {
              type: "string",
              title: "身份证住址",
              component: "Input",
              props: { placeholder: "请输入身份证住址", gridSpan: 24 },
            },
          },
        },
        studentRecords: {
          type: "array",
          title: "学籍信息",
          component: "ArrayCards",
          props: { gridSpan: 12 },
          items: {
            type: "object",
            properties: {
              school: {
                type: "string",
                title: "学校",
                component: "Input",
                props: { placeholder: "请输入学校" },
              },
              headTeacher: {
                type: "string",
                title: "联系人（班主任）",
                component: "Input",
                props: { placeholder: "请输入班主任姓名或联系方式" },
              },
              enrollmentDate: {
                type: "string",
                title: "入学时间",
                component: "Input",
                props: { placeholder: "YYYY-MM-DD" },
              },
              graduationDate: {
                type: "string",
                title: "毕业时间",
                component: "Input",
                props: { placeholder: "YYYY-MM-DD" },
              },
            },
          },
        },
        createBy: {
          type: "string",
          title: "创建者",
          component: "Input",
          display: "hidden",
          default: "_sys_admin",
        },
        // 系统时间戳：显式出现，表单中只读。
        createdAt: { type: "string", title: "创建时间", props: { readOnly: true } },
        updatedAt: { type: "string", title: "更新时间", props: { readOnly: true } },
      },
      group: [
        {
          component: "ObjectField",
          title: "基础信息",
          keys: ["username", "nickname"],
          props: { gridSpan: 12 },
        },
      ],
    },
  },
  pages: [
    {
      router: "list",
      title: "用户管理",
      layout: {
        component: "layout",
        props: { rightTop: "filter", rightBottom: "table" },
      },
      properties: {
        filter: {
          type: "string",
          component: "filter",
          props: {
            // filter 遍历 fields 中 filterable 且非 object/array 的字段，component/props 从 form-schema 取
            schema: { $ref: "form-schema" },
            filters: "{{ $utils.schemaToFilters }}",
            defaultValue: "{{ $query.keyword }}",
          },
        },
        table: {
          // void 下所有字段都是无值的；父节点为 void，其下所有节点都无值
          type: "void",
          component: "table",
          props: {
            rowKey: "id",
            modelCode: "_sys_user",
            schema: { $ref: "form-schema" },
            // columns 遍历 fields 生成，渲染组件从 form-schema 按 key 取（收口于 schemaToColumns）；
            // 列初始可见性取自 fields.visible，用户调整后的 visible/width/fixed 由组件读写本地缓存
            columns: "{{ $utils.schemaToColumns }}",
            filter: "{{ $values.filter }}",
            loadData: "{{ (params) => $service.records.list({ model: '_sys_user', ...params }) }}",
            // 指定的 properties 进入每行操作列；其余 properties 作为 children 数组进入工具栏右侧
            rowActions: ["deactivate", "delete"],
            "action-btns": {
              // 新增按钮 props（可填 antd button 其他 props）；openMode 决定打开方式
              add: { type: "primary", children: "新增", openMode: "page" },
              edit: { type: "link", children: "编辑", openMode: "page" },
              detail: { type: "link", children: "详情", openMode: "drawer" },
              batchDelete: {
                children: "批量删除",
                danger: true,
                service: "{{ $service.records.batchDelete }}",
              },
            },
          },
          properties: {
            deactivate: {
              type: "void",
              component: "row-button",
              props: {
                danger: true,
                children: "停用",
                onClick: "{{ ($row) => $utils.message.info('功能未完善') }}",
              },
            },
            delete: {
              type: "void",
              component: "row-button",
              props: {
                danger: true,
                children: "删除",
                confirm: "确认删除这条记录？",
                confirmDescription: "删除后无法恢复。",
                successMessage: "记录已删除",
                refreshAfterSuccess: true,
                disabled: "{{ $row.id === '_sys_admin' }}",
                onClick:
                  "{{ ($row) => $service.records.delete({ model: '_sys_user', id: $row.id, record: $row }) }}",
              },
            },
            import: {
              type: "void",
              component: "Button",
              props: {
                children: "导入",
                onClick: "{{ () => $utils.message.info('功能未完善') }}",
              },
            },
            export: {
              type: "void",
              component: "Button",
              props: {
                children: "导出",
                onClick: "{{ () => $utils.message.info('功能未完善') }}",
              },
            },
          },
        },
      },
    },
    {
      router: "add",
      title: "新建用户",
      properties: {
        form: {
          type: "void",
          component: "record-form",
          props: {
            ok: "确认新增",
            mode: "add",
            modelCode: "_sys_user",
            schema: { $ref: "form-schema" },
            // 组件内部 props.submit(values)
            submit: "{{ $service.record.add }}",
          },
        },
      },
    },
    {
      router: "edit",
      title: "编辑用户",
      properties: {
        form: {
          type: "void",
          component: "record-form",
          props: {
            ok: "确认修改",
            mode: "edit",
            modelCode: "_sys_user",
            recordId: "{{ $query.id }}",
            schema: { $ref: "form-schema" },
            submit: "{{ $service.record.edit }}",
          },
        },
      },
    },
  ],
};
