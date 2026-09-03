import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Popconfirm, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import type { GroupDraft, ModelAction, ModelDraft, PageDraft } from "../builder";
import { GroupModal } from "./group-modal";
import { PageModal } from "./page-modal";

/**
 * 页面配置步骤：上方「字段分组」表格，下方「页面配置」表格。
 * 分组与页面均通过弹窗新增/编辑/删除；页面弹窗支持套用代码写死的模版。
 */
export function PageConfig({
  draft,
  dispatch,
}: {
  draft: ModelDraft;
  dispatch: (action: ModelAction) => void;
}) {
  const { message } = App.useApp();
  const [groupEditor, setGroupEditor] = useState<{ group?: GroupDraft } | undefined>();
  const [pageEditor, setPageEditor] = useState<{ page?: PageDraft } | undefined>();

  const replaceGroups = (groups: GroupDraft[]) => dispatch({ type: "groups.replace", groups });
  const replacePages = (pages: PageDraft[]) => dispatch({ type: "pages.replace", pages });

  const groupColumns: ColumnsType<GroupDraft> = [
    {
      title: "标题",
      dataIndex: "title",
      width: 180,
      render: (value?: string) =>
        value || <Typography.Text type="secondary">未命名</Typography.Text>,
    },
    {
      title: "包含字段",
      render: (_v, row) =>
        row.keys.length ? (
          <Space size={[4, 4]} wrap>
            {row.keys.map((key) => (
              <Tag key={key}>{key}</Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">无</Typography.Text>
        ),
    },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_v, row) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setGroupEditor({ group: row })}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该分组？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => replaceGroups(draft.groups.filter((item) => item.id !== row.id))}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const pageColumns: ColumnsType<PageDraft> = [
    {
      title: "路由",
      width: 160,
      render: (_v, row) => <Typography.Text code>{row.page.router}</Typography.Text>,
    },
    { title: "标题", render: (_v, row) => row.page.title || "—" },
    {
      title: "布局",
      width: 140,
      render: (_v, row) =>
        row.page.layout?.component ? (
          <Typography.Text code>{row.page.layout.component}</Typography.Text>
        ) : (
          "—"
        ),
    },
    {
      title: "属性数",
      width: 90,
      render: (_v, row) => Object.keys(row.page.properties ?? {}).length,
    },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_v, row) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setPageEditor({ page: row })}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该页面？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => replacePages(draft.pages.filter((item) => item.id !== row.id))}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card
        title="字段分组"
        extra={
          <Button type="link" icon={<PlusOutlined />} onClick={() => setGroupEditor({})}>
            新增分组
          </Button>
        }
      >
        <Table<GroupDraft>
          rowKey="id"
          size="small"
          columns={groupColumns}
          dataSource={draft.groups}
          pagination={false}
          locale={{ emptyText: "暂无分组，未分组字段按顺序平铺" }}
        />
      </Card>
      <Card
        title="页面配置"
        extra={
          <Button type="link" icon={<PlusOutlined />} onClick={() => setPageEditor({})}>
            新增页面
          </Button>
        }
      >
        <Table<PageDraft>
          rowKey="id"
          size="small"
          columns={pageColumns}
          dataSource={draft.pages}
          pagination={false}
          locale={{ emptyText: "暂无页面，保存时将按默认模版生成 list/add/edit/detail" }}
        />
      </Card>
      <GroupModal
        open={Boolean(groupEditor)}
        group={groupEditor?.group}
        draft={draft}
        onCancel={() => setGroupEditor(undefined)}
        onSubmit={(group) => {
          const exists = draft.groups.some((item) => item.id === group.id);
          replaceGroups(
            exists
              ? draft.groups.map((item) => (item.id === group.id ? group : item))
              : [...draft.groups, group],
          );
          setGroupEditor(undefined);
          message.success(exists ? "分组已更新" : "分组已新增");
        }}
      />
      <PageModal
        open={Boolean(pageEditor)}
        page={pageEditor?.page}
        draft={draft}
        onCancel={() => setPageEditor(undefined)}
        onSubmit={(page) => {
          const exists = draft.pages.some((item) => item.id === page.id);
          replacePages(
            exists
              ? draft.pages.map((item) => (item.id === page.id ? page : item))
              : [...draft.pages, page],
          );
          setPageEditor(undefined);
          message.success(exists ? "页面已更新" : "页面已新增");
        }}
      />
    </Flex>
  );
}
