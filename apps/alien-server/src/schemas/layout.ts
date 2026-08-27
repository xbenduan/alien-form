/**
 * 内置模型的默认页面布局。
 *
 * 协议唯一真相源为 runtime（@alien-form/engine 的 UiNode）：节点即
 * { component, props?, children?, slots? }，不再包 $af-ui 插件标记。
 * 前端拿到 x-layout 后可直接塞进 PageSchema.layout 渲染。
 *
 * 根节点 props.services 声明「布局语义 → 已注册 service code」的映射，
 * 数据类组件按语义 key 自取 service，不在组件实现里写死 service code。
 */

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
  component: "layout",
  props: { services: RECORD_SERVICES },
  slots: {
    rightTop: { component: "filter", props: { scope: "main" } },
    rightBottom: {
      component: "table",
      props: { scope: "main" },
      slots: {
        toolbarLeft: { component: "action-batch-delete" },
        toolbarRight: {
          component: "action-group",
          children: [{ component: "action-refresh" }, { component: "action-add" }],
        },
      },
      children: [
        {
          component: "row-actions",
          children: [{ component: "detail" }, { component: "edit" }, { component: "delete" }],
        },
      ],
    },
  },
} as const;

/**
 * 用户树表布局：左侧组织树来源于 school-department（部门只管自己的层级），
 * 选中部门后按 school-user.deptCode IN [子树所有 deptCode] 过滤用户表。
 * 这是「组织树驱动成员表」的通用形态——公司/员工等场景把 model/字段换掉即可复用。
 */
export const schoolUserLayout = {
  component: "layout",
  props: { services: TREE_SERVICES },
  slots: {
    left: {
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
    rightTop: { component: "filter", props: { scope: "main" } },
    rightBottom: {
      component: "table",
      props: { scope: "main" },
      slots: {
        toolbarLeft: { component: "action-batch-delete" },
        toolbarRight: {
          component: "action-group",
          children: [{ component: "action-refresh" }, { component: "action-add" }],
        },
      },
      children: [
        {
          component: "row-actions",
          children: [{ component: "detail" }, { component: "edit" }, { component: "delete" }],
        },
      ],
    },
  },
} as const;

/**
 * 部门/组织树表布局：左树导航（含叶子节点，班级/党团组织可直接点选），右表 + 增删改。
 * tree.hideLeaf=false 让班级这类叶子部门也出现在导航树里（用户页仍默认隐藏学生叶子）。
 */
export const schoolDepartmentLayout = {
  component: "layout",
  props: { services: TREE_SERVICES },
  slots: {
    left: {
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
    rightTop: { component: "filter", props: { scope: "main" } },
    rightBottom: {
      component: "table",
      props: { scope: "main" },
      slots: {
        toolbarLeft: { component: "action-batch-delete" },
        toolbarRight: {
          component: "action-group",
          children: [{ component: "action-refresh" }, { component: "action-add" }],
        },
      },
      children: [
        {
          component: "row-actions",
          children: [{ component: "detail" }, { component: "edit" }, { component: "delete" }],
        },
      ],
    },
  },
} as const;
