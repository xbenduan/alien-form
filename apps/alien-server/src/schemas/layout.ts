/** 内置模型的默认页面布局；模型构建器也使用同一份协议形态生成布局。 */
export const defaultLayout = {
  plugin: "$af-ui",
  component: "page",
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

export const schoolUserLayout = {
  plugin: "$af-ui",
  component: "treelayout",
  slots: {
    tree: [
      {
        plugin: "$af-ui",
        component: "tree",
        props: {
          model: "school-user",
          idField: "userNo",
          parentField: "parentCode",
          labelField: "displayName",
          searchable: true,
          publishTo: "main",
          targetField: "userNo",
          includeSelf: true,
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
