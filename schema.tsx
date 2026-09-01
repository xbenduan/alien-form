// ============================================================
//  Alien-Form 页面协议 · 类型契约（唯一真相源）
//
//  归一原则：不存在"页面专属"概念，全部落在 alien-form 已有能力上：
//    - type          决定数据行为（void=不收值容器 / 其它=收值输入源）
//    - properties    唯一语义：字段树（void 字段不占 form.values 路径）
//    - props         注入组件的参数；具名插槽在此声明（引用同级 properties 字段名）
//    - x-layout/type:void  布局/展示节点
//    - {{ }} / $ref  表达式 / 静态引用
// ============================================================

/** {{ }} 表达式：new Function 求值。隐式 () => (expr)；含 => 即函数工厂 */
type Expr = string;
/** $ref：静态结构引用，只指向 root.definitions，永不含表达式 */
type Ref = { $ref: string };
type PropValue =
  | string
  | number
  | boolean
  | null
  | Expr
  | Ref
  | PropValue[]
  | { [k: string]: PropValue };

interface FieldSchema {
  /**
   * 数据行为：
   *   收值输入源（string/number/object/array…）→ 组件 onChange 写回 $values[path]
   *   "void" → 不占数据路径、不产生值、无 onChange；用于布局/展示/操作容器
   */
  type?: "string" | "number" | "boolean" | "object" | "array" | "void";
  title?: string;
  component?: string;
  /** 注入组件的 props；具名插槽写在这里，值为同级 properties 的字段名 */
  props?: Record<string, PropValue>;
  /** 字段树；void 字段的子节点在数据上"上浮"（不建嵌套路径），渲染归属由父组件插槽控制 */
  properties?: Record<string, FieldSchema>;
  /** 值的序列化格式（如 filter 用 json：写时 stringify / 读时 parse） */
  "x-format"?: Expr | "json";
  "x-reaction"?: Expr;
  dataSource?: Expr | PropValue;
  $ref?: string;
}

interface XPage {
  router: string; // 静态路径段，如 "list" / "edit/{modelCode}"
  /** 可选：有则按布局组件排（props 声明具名插槽，引用 schema.properties 字段名）；无则默认 pageCard */
  layout?: { component: string; props?: Record<string, PropValue> };
  schema: { properties: Record<string, FieldSchema> }; // 一份 alien-form schema
}

interface BuilderSchema {
  meta?: { name?: string; title?: string; openMode?: string; defaultPageSize?: number };
  "x-pages": XPage[];
  definitions?: Record<string, unknown>; // 被 $ref 指向
}

// ── 表达式命名空间（经 useCreateForm 的 scope/handlers 注入，全页可用）──
//  $service(code)  异步服务工厂，返回"未调用"的函数（组件内部自行调用）
//  $utils.xxx      同步纯函数，返回"未调用"的函数（组件内部 props.fn(props.schema) 调用）
//  $enums.xxx      同步枚举/常量（原 constant 改名）
//  $query.xxx      URL 查询参数（外部输入通道）
//  $values.xxx     当前 form 字段值 —— 组件间联动的唯一桥梁
//  求值 new Function；隐式 ()=>expr；含 => 即函数。$ref 只做静态结构引用。

// ============================================================
//  Golden Schema · modelCode = _sys_models（穷尽所有可能性）
// ============================================================
const builderSchema: BuilderSchema = {
  meta: { name: "_sys_models", title: "模型管理", openMode: "route", defaultPageSize: 20 },

  "x-pages": [
    // ---------- 列表页：tree / filter / table 三组件联动 ----------
    {
      router: "list", // -> xxx/_sys_models/list
      // 可选布局：具名插槽引用同级 schema.properties 的字段名；省略则默认 pageCard
      layout: {
        component: "layout",
        props: { left: "tree", rightTop: "filter", rightBottom: "table" },
      },
      schema: {
        properties: {
          // 【输入源】树：组件内部自取数据；点击写回自己的值（onChange(id) -> $values.tree）
          tree: {
            type: "string", // 收值：当前选中节点 id
            component: "menu-tree",
            props: {
              // $utils 返回"未调用"的函数，组件内部 props.buildTree(...) 自行调用
              treelist: "{{ $service('menu.list') }}",
              // 或：treelist: "{{ $utils.buildMenuTree }}"  组件内 props.treelist({ modelCode })
            },
          },

          // 【输入源】筛选器：alien-form 收值组件，值为字符串化 JSON（x-format: json）
          filter: {
            type: "string",
            component: "filter",
            "x-format": "json", // 写时 stringify / 读时 parse
            props: {
              schema: { $ref: "form-schema" },
              // $utils 只提供未调用的方法，组件内部 props.fields(props.schema) 构建
              fields: "{{ $utils.schemaToFields }}",
              defaultValue: "{{ $query.keyword }}", // 初值来自 URL（深链接/刷新保持）
            },
          },

          // 【消费方 / 容器】表格：type void，不收值；靠 props 读兄弟字段值驱动
          table: {
            type: "void",
            component: "table",
            props: {
              rowKey: "id",
              // 组件内部用未调用的 util 从 schema 派生列：props.columns(props.schema)
              columns: "{{ $utils.schemaToColumns }}",
              schema: { $ref: "form-schema" },

              // 组件间联动：读 filter / tree 的字段值（$values 桥梁）
              filter: "{{ $values.filter }}",
              nodeId: "{{ $values.tree }}",

              // 数据请求在组件内部：监听 props.filter/nodeId，用作参数调用
              loadData: "{{ (p) => $service('query.list')(p) }}",

              // 具名插槽：引用同级 properties 的子节点字段名
              toolbar: "toolbar",
              rowActions: ["delete", "edit", "detail"], // 使用 flex 布局
            },
            // 子节点写在 properties，均为 void（不收值），渲染归属由 table 插槽控制
            properties: {
              toolbar: { type: "void", $ref: "list-toolbar" },
              delete: {
                type: "void",
                component: "button",
                props: {
                  children: "删除",
                  // row 由 table 在渲染行时注入调用上下文
                  onDelete:
                    "{{ (row) => $service('query.delete')({ id: row.id, remark: '默认删除' }) }}",
                },
              },
              // 编辑/详情等其它行操作同理
            },
          },
        },
      },
    },

    // ---------- 新增页：复用 form-schema ----------
    {
      router: "add", // -> xxx/_sys_models/add
      schema: {
        properties: {
          model: {
            type: "void",
            component: "builder-model",
            props: { model: "add", schema: { $ref: "form-schema" } },
          },
        },
      },
    },

    // ---------- 编辑页：静态路径段 + 复用同一 form-schema ----------
    {
      router: "edit/{modelCode}", // -> xxx/_sys_models/edit（{modelCode} 固定路径段）
      schema: {
        properties: {
          model: {
            type: "void",
            component: "builder-model",
            props: { model: "edit", schema: { $ref: "form-schema" }, recordId: "{{ $query.id }}" },
          },
        },
      },
    },
  ],

  // ---------- 可复用结构：被 $ref 指向 ----------
  definitions: {
    "form-schema": {
      properties: {
        name: {
          type: "string",
          title: "模型名称",
          "x-reaction": "{{ ({ $values }) => ({ visible: $values.enabled === true }) }}",
        },
        status: { type: "string", title: "状态", dataSource: "{{ $enums.status }}" },
      },
    },
    "list-toolbar": {
      type: "void",
      component: "Flex", // 非具名布局：靠 children 顺序 + Flex props
      properties: {
        batchDelete: { type: "void", component: "button", props: { children: "批量删除" } },
        add: {
          type: "void",
          component: "button",
          props: { children: "新增", onClick: "{{ () => $service('router.go')('add') }}" },
        },
        refresh: {
          type: "void",
          component: "button",
          props: {
            type: "string",
            icon: "refresh",
            onClick: "{{ () => $service('query.list').refetch() }}",
          },
        },
      },
    },
  },
};
