/** 内置模型的默认页面布局；模型构建器也使用同一份协议形态生成布局。 */

/** 记录型页面的默认 service 语义映射（与前端 DEFAULT_RECORD_SERVICES 同构）。 */
const RECORD_SERVICES = {
  "query.list": "records.list",
  "query.filter": "records.list",
  "query.detail": "records.get",
  "create.record": "records.create",
  "update.record": "records.update",
  "delete.record": "records.delete",
  "delete.recordMany": "records.deleteMany",
};

/** 树表布局追加子树查询 service。 */
const TREE_SERVICES = {
  ...RECORD_SERVICES,
  "query.subtree": "records.subtree",
};

export const defaultLayout = {
  plugin: "$af-ui",
  component: "page",
  props: { services: RECORD_SERVICES },
  children: [
    { plugin: "$af-ui", component: "filter", props: { scope: "main" } },
    {
      plugin: "$af-ui",
      component: "table",
      props: { scope: "main" },
      slots: {
        toolbarLeft: [{ plugin: "$af-ui", component: "action-batch-delete" }],
        toolbarRight: [
          { plugin: "$af-ui", component: "action-refresh" },
          { plugin: "$af-ui", component: "action-add" },
        ],
      },
      children: [
        {
          plugin: "$af-ui",
          component: "row-actions",
          children: [
            { plugin: "$af-ui", component: "detail" },
            { plugin: "$af-ui", component: "edit" },
            { plugin: "$af-ui", component: "delete" },
          ],
        },
      ],
    },
  ],
} as const;

/**
 * 用户树表布局：左侧组织树来源于 school-department（部门只管自己的层级），
 * 选中部门后按 school-user.deptCode IN [子树所有 deptCode] 过滤用户表。
 * 这是「组织树驱动成员表」的通用形态——公司/员工等场景把 model/字段换掉即可复用。
 */
export const schoolUserLayout = {
  plugin: "$af-ui",
  component: "treelayout",
  props: { services: TREE_SERVICES },
  slots: {
    tree: [
      {
        plugin: "$af-ui",
        component: "tree",
        props: {
          // 树取自部门模型，过滤打到用户模型的 deptCode 标量列。
          model: "school-department",
          idField: "deptCode",
          parentField: "parentCode",
          labelField: "deptName",
          searchable: true,
          publishTo: "main",
          targetField: "deptCode",
          includeSelf: true,
          hideLeaf: false,
          defaultSelect: "root",
        },
      },
    ],
    filter: [{ plugin: "$af-ui", component: "filter", props: { scope: "main" } }],
    table: [
      {
        plugin: "$af-ui",
        component: "table",
        props: { scope: "main" },
        slots: {
          toolbarLeft: [{ plugin: "$af-ui", component: "action-batch-delete" }],
          toolbarRight: [
            { plugin: "$af-ui", component: "action-refresh" },
            { plugin: "$af-ui", component: "action-add" },
          ],
        },
        children: [
          {
            plugin: "$af-ui",
            component: "row-actions",
            children: [
              { plugin: "$af-ui", component: "detail" },
              { plugin: "$af-ui", component: "edit" },
              { plugin: "$af-ui", component: "delete" },
            ],
          },
        ],
      },
    ],
  },
} as const;

/**
 * 部门/组织树表布局：左树导航（含叶子节点，班级/党团组织可直接点选），右表 + 增删改。
 * tree.hideLeaf=false 让班级这类叶子部门也出现在导航树里（用户页仍默认隐藏学生叶子）。
 */
export const schoolDepartmentLayout = {
  plugin: "$af-ui",
  component: "treelayout",
  props: { services: TREE_SERVICES },
  slots: {
    tree: [
      {
        plugin: "$af-ui",
        component: "tree",
        props: {
          model: "school-department",
          idField: "deptCode",
          parentField: "parentCode",
          labelField: "deptName",
          searchable: true,
          publishTo: "main",
          targetField: "deptCode",
          includeSelf: true,
          hideLeaf: false,
          defaultSelect: "root",
        },
      },
    ],
    filter: [{ plugin: "$af-ui", component: "filter", props: { scope: "main" } }],
    table: [
      {
        plugin: "$af-ui",
        component: "table",
        props: { scope: "main" },
        slots: {
          toolbarLeft: [{ plugin: "$af-ui", component: "action-batch-delete" }],
          toolbarRight: [
            { plugin: "$af-ui", component: "action-refresh" },
            { plugin: "$af-ui", component: "action-add" },
          ],
        },
        children: [
          {
            plugin: "$af-ui",
            component: "row-actions",
            children: [
              { plugin: "$af-ui", component: "detail" },
              { plugin: "$af-ui", component: "edit" },
              { plugin: "$af-ui", component: "delete" },
            ],
          },
        ],
      },
    ],
  },
} as const;
