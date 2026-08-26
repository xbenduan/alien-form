import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createRuntime,
  MemoryRouterAdapter,
  RuntimeProvider,
  PageRoot,
  Slot,
  useListBlock,
  usePage,
  useFormBlock,
  FormBlockRenderer,
  type ComponentProps,
  type PageSchema,
  type ServiceDescriptor,
} from "@alien-form/engine/react";
import type { IFormSchema } from "@alien-form/core";

// ─── Mock data ──────────────────────────────────────────────────────────────
const ALL_USERS = Array.from({ length: 47 }, (_, i) => ({
  id: i + 1,
  name: `用户 ${i + 1}`,
  email: `user${i + 1}@example.com`,
  deptCode: `D${String((i % 5) + 1).padStart(3, "0")}`,
  status: i % 3 === 0 ? "inactive" : "active",
}));

const DEPTS = [
  { label: "研发部", value: "D001" },
  { label: "产品部", value: "D002" },
  { label: "设计部", value: "D003" },
  { label: "市场部", value: "D004" },
  { label: "人事部", value: "D005" },
];

// ─── Mock service ───────────────────────────────────────────────────────────
const recordsListService: ServiceDescriptor = {
  code: "records.list",
  async send(params) {
    await new Promise((r) => setTimeout(r, 300));
    const { filters = {}, pagination = { current: 1, pageSize: 10 } } = params as {
      filters: Record<string, unknown>;
      pagination: { current: number; pageSize: number };
    };
    let list = [...ALL_USERS];
    if (filters.name) {
      list = list.filter((u) => u.name.includes(String(filters.name)));
    }
    const start = (pagination.current - 1) * pagination.pageSize;
    return { list: list.slice(start, start + pagination.pageSize), total: list.length };
  },
};

// ─── Page-level UI components ───────────────────────────────────────────────

function Page({ children }: ComponentProps) {
  return <div className="page">{children as React.ReactNode}</div>;
}

function PageHeader({ node }: ComponentProps) {
  return (
    <div className="card">
      <h1>{(node.props?.title as string) ?? "页面"}</h1>
    </div>
  );
}

function FilterBar() {
  const page = usePage();
  const listBlock = page.block("main") as unknown as {
    setFilterPatch: (p: Record<string, unknown>) => void;
  };
  const [name, setName] = useState("");

  return (
    <div className="card">
      <div className="filter-bar">
        <input
          placeholder="搜索姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") listBlock.setFilterPatch({ name });
          }}
        />
        <button onClick={() => listBlock.setFilterPatch({ name })}>搜索</button>
        <button
          onClick={() => {
            setName("");
            listBlock.setFilterPatch({ name: undefined });
          }}
        >
          重置
        </button>
      </div>
    </div>
  );
}

function UserTable() {
  const { data, total, loading, pagination, setPagination } = useListBlock("main");
  const totalPages = Math.ceil(total / pagination.pageSize);

  if (loading) return <div className="card loading">加载中...</div>;

  return (
    <div className="card">
      <div className="toolbar">
        <h2>用户列表</h2>
        <Slot name="toolbarRight" />
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>姓名</th>
            <th>邮箱</th>
            <th>部门</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {(data as typeof ALL_USERS).map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{DEPTS.find((d) => d.value === u.deptCode)?.label ?? u.deptCode}</td>
              <td>
                <span className={`badge badge-${u.status}`}>
                  {u.status === "active" ? "在职" : "离职"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <span>共 {total} 条</span>
        <button
          disabled={pagination.current <= 1}
          onClick={() => setPagination({ ...pagination, current: pagination.current - 1 })}
        >
          上一页
        </button>
        <span>
          {pagination.current} / {totalPages}
        </span>
        <button
          disabled={pagination.current >= totalPages}
          onClick={() => setPagination({ ...pagination, current: pagination.current + 1 })}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function RefreshButton() {
  const page = usePage();
  const block = page.block("main") as unknown as { refresh: () => void };
  return <button onClick={() => block.refresh()}>刷新</button>;
}

// ─── Form page component: renders the "form" block ─────────────────────────

function FormPanel() {
  const { submit, submitting, values, valid } = useFormBlock("form");
  return (
    <div className="card">
      <h2>新建用户（alien-form 渲染）</h2>
      <FormBlockRenderer blockName="form" />
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          disabled={submitting || !valid}
          onClick={async () => {
            try {
              await submit();
              alert("提交成功: " + JSON.stringify(values.get ? values : values));
            } catch (e) {
              console.error(e);
            }
          }}
        >
          {submitting ? "提交中..." : "提交"}
        </button>
        <span style={{ color: valid ? "#52c41a" : "#ff4d4f", fontSize: 12 }}>
          {valid ? "✓ 校验通过" : "请完善必填项"}
        </span>
      </div>
    </div>
  );
}

// ─── alien-form field components (registered via runtime.formComponent) ─────

function FieldInput({ value, onChange, disabled, placeholder }: any) {
  return (
    <input
      value={value ?? ""}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      style={{ padding: "6px 10px", border: "1px solid #d9d9d9", borderRadius: 4, width: "100%" }}
    />
  );
}

function FieldSelect({ value, onChange, dataSource, disabled }: any) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      style={{ padding: "6px 10px", border: "1px solid #d9d9d9", borderRadius: 4, width: "100%" }}
    >
      <option value="">请选择</option>
      {(dataSource ?? []).map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function FieldItem({ label, required, errors, children }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", marginBottom: 4, fontWeight: 500, fontSize: 14 }}>
        {required ? <span style={{ color: "#ff4d4f" }}>* </span> : null}
        {label}
      </label>
      {children}
      {errors?.length > 0 && (
        <div style={{ color: "#ff4d4f", fontSize: 12, marginTop: 2 }}>{errors[0]?.message}</div>
      )}
    </div>
  );
}

// ─── Page schema ────────────────────────────────────────────────────────────

const formSchema: IFormSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "姓名",
      required: true,
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "请输入姓名" },
    },
    email: {
      type: "string",
      title: "邮箱",
      required: true,
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "请输入邮箱" },
    },
    deptCode: {
      type: "string",
      title: "部门",
      component: "Select",
      decorator: "FormItem",
      dataSource: DEPTS,
    },
  },
};

const userPageSchema: PageSchema = {
  id: "user-list",
  domain: "user",
  title: "用户管理",
  blocks: [
    {
      name: "main",
      type: "list",
      service: "records.list",
      pagination: { current: 1, pageSize: 10 },
    },
    {
      name: "form",
      type: "form",
      formSchema,
    },
  ],
  layout: {
    component: "page",
    children: [
      { component: "page-header", props: { title: "用户管理" } },
      { component: "filter", block: "main" },
      {
        component: "table",
        block: "main",
        slots: {
          toolbarRight: [{ component: "action-refresh" }],
        },
      },
      { component: "form-panel", block: "form" },
    ],
  },
};

// ─── Bootstrap ──────────────────────────────────────────────────────────────
const runtime = createRuntime({
  router: new MemoryRouterAdapter({ path: "/users" }),
});

// Page-level UI components
runtime.component("page", { component: Page });
runtime.component("page-header", { component: PageHeader });
runtime.component("filter", { component: FilterBar });
runtime.component("table", { component: UserTable });
runtime.component("action-refresh", { component: RefreshButton });
runtime.component("form-panel", { component: FormPanel });

// alien-form field components & decorators
runtime.formComponent("Input", FieldInput);
runtime.formComponent("Select", FieldSelect);
runtime.formDecorator("FormItem", FieldItem);

runtime.service(recordsListService);

function App() {
  return (
    <RuntimeProvider runtime={runtime}>
      <PageRoot schema={userPageSchema} />
    </RuntimeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
